const axios = require('axios');
const { logger } = require('../config/logger');

class DexScreenerService {
    static async getTokenDetails(tokenAddress) {
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
            
            if (response.data && response.data.pairs && response.data.pairs.length > 0) {
                // Preferisci il pair di Raydium se disponibile
                const pair = response.data.pairs.find(p => p.dexId === 'raydium') || response.data.pairs[0];
                
                // Converti il timestamp di creazione da millisecondi a secondi
                const createdAt = pair.pairCreatedAt ? Math.floor(pair.pairCreatedAt / 1000) : null;
                
                return {
                    address: tokenAddress,
                    symbol: pair.baseToken.symbol,
                    name: pair.baseToken.name,
                    priceUsd: parseFloat(pair.priceUsd) || 0,
                    createdAt: createdAt,
                    dexScreenerUrl: `https://dexscreener.com/solana/${tokenAddress}`,
                    links: {
                        dexscreener: `https://dexscreener.com/solana/${tokenAddress}`,
                        photon: `https://photon-sol.tinyastro.io/en/lp/${pair.pairAddress}?handle=1791547328df5c98cbbb7`,
                        rugcheck: `https://rugcheck.xyz/tokens/${tokenAddress}`
                    }
                };
            }
            return null;
        } catch (error) {
            logger.error(`Error fetching token details from DexScreener: ${error.message}`);
            return null;
        }
    }
}

module.exports = DexScreenerService;
