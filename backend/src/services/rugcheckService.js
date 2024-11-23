const axios = require('axios');
const { logger } = require('../config/logger');

class RugcheckService {
    static async getTokenDetails(tokenAddress) {
        try {
            logger.info(`Fetching Rugcheck data for token: ${tokenAddress}`);
            
            const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`, {
                timeout: 5000 // 5 secondi di timeout
            });
            
            if (response.data && response.data.tokenMeta) {
                logger.info(`Rugcheck data received: ${JSON.stringify(response.data)}`);
                
                const createdAt = response.data.detectedAt 
                    ? Math.floor(new Date(response.data.detectedAt).getTime() / 1000)
                    : Math.floor(Date.now() / 1000);

                return {
                    address: tokenAddress,
                    symbol: response.data.tokenMeta.symbol || 'N/A',
                    name: response.data.tokenMeta.name || 'N/A',
                    priceUsd: 0, // Rugcheck non fornisce il prezzo
                    createdAt: createdAt,
                    dexScreenerUrl: `https://dexscreener.com/solana/${tokenAddress}`,
                    links: {
                        dexscreener: `https://dexscreener.com/solana/${tokenAddress}`,
                        photon: `https://photon-sol.tinyastro.io/en/lp/${tokenAddress}?handle=1791547328df5c98cbbb7`,
                        rugcheck: `https://rugcheck.xyz/tokens/${tokenAddress}`
                    }
                };
            }
            
            logger.warn(`No token metadata found in Rugcheck response for ${tokenAddress}`);
            return null;
        } catch (error) {
            if (error.response) {
                logger.error(`Rugcheck API error for ${tokenAddress}: ${error.response.status} - ${error.response.statusText}`);
            } else if (error.request) {
                logger.error(`No response from Rugcheck API for ${tokenAddress}: ${error.message}`);
            } else {
                logger.error(`Error fetching Rugcheck data for ${tokenAddress}: ${error.message}`);
            }
            return null;
        }
    }
}

module.exports = RugcheckService;
