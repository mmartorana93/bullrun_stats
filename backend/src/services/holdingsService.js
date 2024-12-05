const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');
const { logger } = require('../config/logger');
const config = require('../config/config');
const WalletService = require('./walletService');

// Lista di token da ignorare (scam/falliti)
const BLACKLISTED_TOKENS = [
  "3rcwsZ86w1npjDBmXBL3XSxxK6TcwSPzXFSuCx2kTFP4",
  "4PUzYSHYrGGRxPdxHhr9aohhTfsQjkgAEMSYzhSraaBU",
  "DtqM56GC8n3as12oF6bQ1vCKjR294zygLchN6tgXwq4q",
  "MWDdkqHWeoGuTS36krDuRjWA1St9yi2SUdQssxLSbNm",
  "ARQwH1iKsmBLEnArct9Qv7LKyTCSeeC3zB6BVQMNizC6",
  "3YWLuAW8vPzzZrWLNcfaTKKyEFwukXG6wfP9ej1WDGty",
  "8VGntkLPxeoS8FCcgA4qvyT4PpYiP2VfCq18stg6iNp4",
  "FBbWk6kC5r66WgEBKEbVs121qNLRfQwpNfdaKfJanWWL",
  "Fqs7sHHyzyQh7ZmZq6Jv3uPzrrSXQWe3bHEREhrJpump",
  "CnHFiwyWA8ppKJ1UYjCFuYXK1HAK91gC4zzxjv4xXxXJ",
  "8ApwmGqp4anzdW5kqm6N4qNFbLMfbGciijrD2ZBPQz9u",
  "7xEdKtj6nX2nvqPGayLi4egSWwr53NYSaVZQLRLapump",
  "HVAn4Z7GazxCDRXvp5MLv9AFrKkxfGLih4sXutedeevk",
  "Wdh8V9VVh1QwvreuNLmads3B7dK3FUkyGHXwkRPCgPX",
  "DeDQFhjhM1W8Cftc3Jr6Rhk6d2pq4qrkk4yXebGXp5jB"
];


class HoldingsService {
    constructor() {
        this.connection = new Connection(config.SOLANA_RPC_URL, {
            commitment: 'confirmed',
            wsEndpoint: config.SOLANA_WS_URL
        });
        this.priceCache = new Map();
        this.PRICE_CACHE_TTL = 60 * 1000; // 1 minuto
        this.walletService = new WalletService();
    }

    async getTokenPrice(tokenAddress) {
        try {
            const cached = this.priceCache.get(tokenAddress);
            if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
                return cached.price;
            }

            logger.info(`Recupero prezzo per token: ${tokenAddress}`);
            const response = await fetch(
                `https://price.jup.ag/v4/price?ids=${tokenAddress}`
            );
            
            if (!response.ok) {
                logger.error(`Errore nella risposta API dei prezzi: ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            if (data.data[tokenAddress]) {
                const price = data.data[tokenAddress].price;
                this.priceCache.set(tokenAddress, {
                    price,
                    timestamp: Date.now()
                });
                return price;
            }
            return null;
        } catch (error) {
            logger.error('Errore nel recupero del prezzo:', error);
            return null;
        }
    }

    async getTokenInfo(mint) {
        try {
            logger.info(`Recupero info per token: ${mint}`);
            const response = await fetch(`https://tokens.jup.ag/token/${mint}`);
            
            if (!response.ok) {
                logger.warn(`Token info non trovate per: ${mint}`);
                return {
                    symbol: mint.slice(0, 4) + '...'
                };
            }

            const data = await response.json();
            return {
                symbol: data.symbol || mint.slice(0, 4) + '...',
                name: data.name
            };
        } catch (error) {
            logger.error('Errore nel recupero info token:', error);
            return {
                symbol: mint.slice(0, 4) + '...'
            };
        }
    }

    async getMyTokens() {
        try {
            logger.info('Recupero token del wallet principale');
            const walletInfo = await this.walletService.getMyWalletInfo();
            logger.info('Wallet info recuperate:', walletInfo);

            if (!walletInfo || !walletInfo.address) {
                throw new Error('Wallet info non disponibili');
            }

            const publicKey = new PublicKey(walletInfo.address);
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            let totalValueUSD = 0;
            const tokens = [];

            // Processa i token accounts
            for (const ta of tokenAccounts.value) {
                const accountData = ta.account.data.parsed.info;
                const amount = accountData.tokenAmount.uiAmount;
                const mint = accountData.mint;

                if (amount > 0 && !BLACKLISTED_TOKENS.includes(mint)) {
                    const price = await this.getTokenPrice(mint);
                    const tokenInfo = await this.getTokenInfo(mint);
                    const value = price ? amount * price : 0;
                    totalValueUSD += value;

                    tokens.push({
                        symbol: tokenInfo.symbol,
                        name: tokenInfo.name,
                        address: mint,
                        amount,
                        price: price || 0,
                        value
                    });
                }
            }

            // Aggiungi SOL balance
            const solBalance = walletInfo.balance;
            const solPrice = await this.getTokenPrice("So11111111111111111111111111111111111111112") || 0;
            const solValue = solBalance * solPrice;
            totalValueUSD += solValue;

            logger.info('Token recuperati con successo');
            return {
                success: true,
                data: {
                    tokens,
                    solBalance,
                    solPrice,
                    solValue,
                    totalValueUSD
                }
            };
        } catch (error) {
            logger.error('Errore nel recupero dei token:', error);
            return {
                success: false,
                error: error.message || 'Errore nel recupero dei token'
            };
        }
    }

    async refreshPrices() {
        try {
            logger.info('Pulizia cache dei prezzi');
            this.priceCache.clear();
            return {
                success: true,
                message: 'Cache dei prezzi svuotata con successo'
            };
        } catch (error) {
            logger.error('Errore nel refresh dei prezzi:', error);
            return {
                success: false,
                error: error.message || 'Errore nel refresh dei prezzi'
            };
        }
    }
}

module.exports = new HoldingsService();
