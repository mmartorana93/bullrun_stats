const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../config/logger');

class CryptoService {
    constructor() {
        this.cache = {
            data: null,
            timestamp: 0,
            updating: false
        };

        this.btcDominanceCache = {
            data: null,
            lastUpdate: 0
        };

        this.CACHE_DURATION = 60000; // 60 secondi
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 5000;
        this.FALLBACK_CACHE_FILE = path.join(__dirname, '../../cache/crypto_data.json');
    }

    async fetchWithRetry(url, retries = 0) {
        try {
            const response = await axios.get(url, {
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 429 && retries < this.MAX_RETRIES) {
                logger.warn(`Rate limit hit, retrying in ${this.RETRY_DELAY}ms... (${retries + 1}/${this.MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.fetchWithRetry(url, retries + 1);
            }
            throw error;
        }
    }

    async saveFallbackCache(data) {
        try {
            await fs.mkdir(path.dirname(this.FALLBACK_CACHE_FILE), { recursive: true });
            await fs.writeFile(this.FALLBACK_CACHE_FILE, JSON.stringify(data));
            logger.info('Fallback cache saved successfully');
        } catch (error) {
            logger.error('Error saving fallback cache:', error);
        }
    }

    async loadFallbackCache() {
        try {
            const data = await fs.readFile(this.FALLBACK_CACHE_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error('Error loading fallback cache:', error);
            return null;
        }
    }

    async getBitcoinDominance() {
        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

        try {
            if (this.btcDominanceCache.data && (now - this.btcDominanceCache.lastUpdate) < CACHE_DURATION) {
                logger.info('Returning cached BTC dominance data:', this.btcDominanceCache.data);
                return this.btcDominanceCache.data;
            }

            logger.info('Fetching new BTC dominance data from CoinGecko');
            const response = await this.fetchWithRetry('https://api.coingecko.com/api/v3/global');
            
            const btcDominance = response.data.market_cap_percentage.btc;
            
            this.btcDominanceCache = {
                data: {
                    btcDominance: btcDominance,
                    lastUpdate: new Date().toISOString()
                },
                lastUpdate: now
            };

            return this.btcDominanceCache.data;
        } catch (error) {
            logger.error('Error in getBitcoinDominance:', error);
            throw error;
        }
    }

    async updateAllData() {
        if (this.cache.updating) return this.cache.data;
        
        const now = Date.now();
        if (this.cache.data && (now - this.cache.timestamp) < this.CACHE_DURATION) {
            logger.info('Serving cached data');
            return this.cache.data;
        }

        try {
            this.cache.updating = true;
            logger.info('Fetching fresh data from CoinGecko');
            
            const [globalData, defiData, tetherData] = await Promise.all([
                this.fetchWithRetry('https://api.coingecko.com/api/v3/global'),
                this.fetchWithRetry('https://api.coingecko.com/api/v3/global/decentralized_finance_defi'),
                this.fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_market_cap=true')
            ]);

            const newData = {
                global: globalData,
                defi: defiData,
                tether: tetherData,
                timestamp: now
            };

            this.cache.data = newData;
            this.cache.timestamp = now;
            
            await this.saveFallbackCache(newData);
            
            logger.info('Data successfully updated');
            return newData;
        } catch (error) {
            logger.error('Error updating data:', error);
            
            if (this.cache.data) {
                logger.info('Using memory cache');
                return this.cache.data;
            }
            
            logger.info('Trying fallback cache');
            const fallbackData = await this.loadFallbackCache();
            if (fallbackData) {
                logger.info('Using fallback cache');
                return fallbackData;
            }
            
            return null;
        } finally {
            this.cache.updating = false;
        }
    }

    startPeriodicUpdate() {
        setInterval(() => this.updateAllData(), this.CACHE_DURATION);
    }
}

module.exports = new CryptoService();
