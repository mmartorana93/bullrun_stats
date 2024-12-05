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

    async getBatchTokenInfo(mints) {
        const tokenMap = new Map();
        
        try {
            logger.info('Recupero prezzi batch per:', mints);
            const priceResponse = await fetch(
                `https://api.jup.ag/price/v2?ids=${mints.join(',')}`
            );
            
            if (!priceResponse.ok) {
                logger.error('Errore nella risposta API dei prezzi batch');
                return tokenMap;
            }

            const priceData = await priceResponse.json();

            for (const mint of mints) {
                try {
                    const tokenResponse = await fetch(`https://tokens.jup.ag/token/${mint}`);
                    if (tokenResponse.ok) {
                        const tokenData = await tokenResponse.json();
                        const priceInfo = priceData.data[mint];
                        
                        tokenMap.set(mint, {
                            price: priceInfo ? Number(priceInfo.price) : 0,
                            symbol: tokenData.symbol || mint.slice(0, 4) + '...',
                            name: tokenData.name
                        });
                    } else if (priceData.data[mint]) {
                        tokenMap.set(mint, {
                            price: Number(priceData.data[mint].price),
                            symbol: mint.slice(0, 4) + '...'
                        });
                    }
                } catch (error) {
                    logger.error(`Errore nel recupero info per token ${mint}:`, error);
                    if (priceData.data[mint]) {
                        tokenMap.set(mint, {
                            price: Number(priceData.data[mint].price),
                            symbol: mint.slice(0, 4) + '...'
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Errore nel recupero batch dei prezzi:', error);
        }
        return tokenMap;
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

            // Raccogli prima tutti i mint rilevanti
            const relevantMints = tokenAccounts.value
                .map(ta => ta.account.data.parsed.info)
                .filter(info => info.tokenAmount.uiAmount > 0)
                .filter(info => !BLACKLISTED_TOKENS.includes(info.mint))
                .map(info => info.mint);

            // Aggiungi SOL
            relevantMints.push("So11111111111111111111111111111111111111112");

            // Recupera info per tutti i token in una volta
            const tokenInfo = await this.getBatchTokenInfo(relevantMints);

            let totalValueUSD = 0;
            const tokens = [];

            // Processa i token accounts
            for (const ta of tokenAccounts.value) {
                const accountData = ta.account.data.parsed.info;
                const amount = accountData.tokenAmount.uiAmount;
                const mint = accountData.mint;

                if (amount > 0 && !BLACKLISTED_TOKENS.includes(mint)) {
                    const info = tokenInfo.get(mint);
                    const value = info?.price ? amount * info.price : 0;
                    totalValueUSD += value;

                    tokens.push({
                        symbol: info?.symbol || mint.slice(0, 4) + '...',
                        name: info?.name,
                        address: mint,
                        amount,
                        price: info?.price || 0,
                        value
                    });
                }
            }

            // Aggiungi SOL balance
            const solBalance = walletInfo.balance;
            const solInfo = tokenInfo.get("So11111111111111111111111111111111111111112");
            const solPrice = solInfo?.price || 0;
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
