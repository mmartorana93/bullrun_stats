const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const winston = require('winston');
const axios = require('axios');
require('dotenv').config();

// Configurazione del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'lptracker-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'lptracker.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

class LPTracker {
    constructor(io) {
        this.io = io;
        this.pools = new Map();
        this.connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
        this.wsEndpoint = process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com";
        this.raydiumProgramId = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.setupWebSocket();
    }

    async setupWebSocket() {
        try {
            if (this.ws) {
                this.ws.terminate();
            }

            this.ws = new WebSocket(this.wsEndpoint);

            this.ws.on('open', () => {
                logger.info('WebSocket connesso');
                this.reconnectAttempts = 0;
                this.subscribeToProgram();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.method === 'logsNotification') {
                        this.handleProgramNotification(message);
                    }
                } catch (error) {
                    logger.error('Errore nel parsing del messaggio WebSocket:', error);
                }
            });

            this.ws.on('error', (error) => {
                logger.error('Errore WebSocket:', error);
                this.handleReconnect();
            });

            this.ws.on('close', () => {
                logger.warn('Connessione WebSocket chiusa');
                this.handleReconnect();
            });

        } catch (error) {
            logger.error('Errore nella configurazione WebSocket:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            logger.info(`Tentativo di riconnessione ${this.reconnectAttempts} in ${delay}ms`);
            setTimeout(() => this.setupWebSocket(), delay);
        } else {
            logger.error('Numero massimo di tentativi di riconnessione raggiunto');
        }
    }

    subscribeToProgram() {
        const subscribeMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "logsSubscribe",
            params: [
                { mentions: [this.raydiumProgramId.toBase58()] },
                { commitment: "confirmed" }
            ]
        };

        this.ws.send(JSON.stringify(subscribeMessage));
    }

    async fetchTokenMetadata(tokenAddress) {
        try {
            const response = await axios.get(
                `https://public-api.solscan.io/token/meta?tokenAddress=${tokenAddress}`,
                { timeout: 5000 }
            );
            return response.data;
        } catch (error) {
            logger.error(`Errore nel recupero dei metadata per ${tokenAddress}:`, error);
            return null;
        }
    }

    async handleProgramNotification(message) {
        try {
            const { signature, logs } = message.params.result.value;
            
            if (!logs.some(log => log.includes('initialize2'))) {
                return;
            }

            logger.info(`Nuova pool rilevata: ${signature}`);

            const tx = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.postTokenBalances) {
                return;
            }

            const postTokenBalances = tx.meta.postTokenBalances;
            let tokenAccount, solanaAccount, tokenAmount, solanaAmount;

            for (const balance of postTokenBalances) {
                if (balance.accountIndex === 5) {
                    tokenAccount = balance.mint;
                    tokenAmount = parseFloat(balance.uiTokenAmount.uiAmountString);
                } else if (balance.accountIndex === 6) {
                    solanaAccount = balance.mint;
                    solanaAmount = parseFloat(balance.uiTokenAmount.uiAmountString);
                }
            }

            if (!tokenAccount || !solanaAccount) {
                return;
            }

            const metadata = await this.fetchTokenMetadata(tokenAccount);
            const solPrice = process.env.SOLANA_PRICE || 140.71;
            const usdValue = solanaAmount * solPrice;

            const poolData = {
                tokenAccount,
                tokenAmount,
                solanaAmount,
                usdValue,
                timestamp: new Date().toISOString(),
                txId: signature,
                metadata
            };

            this.pools.set(signature, poolData);
            this.io.emit('newPool', poolData);
            logger.info(`Pool emessa: ${JSON.stringify(poolData)}`);

        } catch (error) {
            logger.error('Errore nella gestione della notifica:', error);
        }
    }

    getExistingPools() {
        return Array.from(this.pools.values());
    }
}

module.exports = LPTracker;
