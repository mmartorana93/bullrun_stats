const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const winston = require('winston');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Configurazione del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
            if (Object.keys(meta).length > 0) {
                logMessage += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
            }
            return logMessage;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: path.join(__dirname, 'logs', 'lptracker-error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, 'logs', 'lptracker.log')
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        level: 'debug',
        format: winston.format.simple()
    }));
}

const WRAPPED_SOL_ADDRESS = "So11111111111111111111111111111111111111112";

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
        this.isRunning = false;
        this.solPrice = 0;
        this.poolMetrics = new Map();
        this.startPriceUpdates();
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.setupWebSocket();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
    }

    async setupWebSocket() {
        try {
            if (this.ws) {
                this.ws.terminate();
            }

            this.ws = new WebSocket(this.wsEndpoint);
            
            // Ping interval
            this.pingInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.ping();
                }
            }, 30000);

            this.ws.on('pong', () => {
            });

            this.ws.on('open', () => {
                logger.info('WebSocket connesso');
                this.reconnectAttempts = 0;
                this.subscribeToProgram();
            });

            this.ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.method === 'logsNotification') {
                        await writeLogToFile('lp-tracker.log', `Nuovo messaggio ricevuto: ${JSON.stringify(message)}`);
                        this.handleProgramNotification(message);
                    }
                } catch (error) {
                    await writeLogToFile('error.log', `Errore nel parsing del messaggio WebSocket: ${error.message}`);
                }
            });

            this.ws.on('error', (error) => {
                logger.error('Errore WebSocket:', error);
                this.handleReconnect();
            });

            this.ws.on('close', () => {
                logger.warn('Connessione WebSocket chiusa');
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                }
                this.handleReconnect();
            });

        } catch (error) {
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
            }
            logger.error('Errore nella configurazione WebSocket:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.isRunning) {
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

    calculatePoolMetrics(poolData) {
        const { tokenAmount, solanaAmount, usdValue } = poolData;
        
        // Calcolo prezzo per token in SOL e USD
        const pricePerTokenSOL = solanaAmount / tokenAmount;
        const pricePerTokenUSD = usdValue / tokenAmount;

        // Calcolo della profondità della pool
        const poolDepth = Math.sqrt(tokenAmount * solanaAmount);

        // Calcolo della liquidità normalizzata
        const normalizedLiquidity = usdValue / poolDepth;

        return {
            pricePerTokenSOL,
            pricePerTokenUSD,
            poolDepth,
            normalizedLiquidity,
            timestamp: Date.now()
        };
    }

    updatePoolMetrics(poolId, newMetrics) {
        const existingMetrics = this.poolMetrics.get(poolId) || [];
        existingMetrics.push(newMetrics);

        // Mantieni solo le ultime 100 metriche per pool
        if (existingMetrics.length > 100) {
            existingMetrics.shift();
        }

        this.poolMetrics.set(poolId, existingMetrics);

        // Calcola variazioni
        if (existingMetrics.length > 1) {
            const previous = existingMetrics[existingMetrics.length - 2];
            const current = existingMetrics[existingMetrics.length - 1];

            const priceChangeSOL = ((current.pricePerTokenSOL - previous.pricePerTokenSOL) / previous.pricePerTokenSOL) * 100;
            const priceChangeUSD = ((current.pricePerTokenUSD - previous.pricePerTokenUSD) / previous.pricePerTokenUSD) * 100;
            const liquidityChange = ((current.normalizedLiquidity - previous.normalizedLiquidity) / previous.normalizedLiquidity) * 100;

            logger.info('Variazioni Pool Metriche', {
                poolId,
                priceChangeSOL: `${priceChangeSOL.toFixed(2)}%`,
                priceChangeUSD: `${priceChangeUSD.toFixed(2)}%`,
                liquidityChange: `${liquidityChange.toFixed(2)}%`,
                timeframe: `${((current.timestamp - previous.timestamp) / 1000).toFixed(1)}s`
            });

            return {
                priceChangeSOL,
                priceChangeUSD,
                liquidityChange,
                timeframe: current.timestamp - previous.timestamp
            };
        }

        return null;
    }

    async handleProgramNotification(message) {
        try {
            const { signature, logs } = message.params.result.value;
            
            if (!logs.some(log => log.includes('initialize2'))) {
                return;
            }

            logger.debug(`Processing transaction: ${signature}`);

            const tx = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.postTokenBalances) {
                return;
            }

            const postTokenBalances = tx.meta.postTokenBalances;
            let tokenData = null;
            let solanaData = null;

            for (const balance of postTokenBalances) {
                if (balance.mint === WRAPPED_SOL_ADDRESS) {
                    solanaData = {
                        account: balance.mint,
                        amount: parseFloat(balance.uiTokenAmount.uiAmountString)
                    };
                    logger.debug(`Solana data found: ${balance.mint}, Amount: ${balance.uiTokenAmount.uiAmountString}`);
                } else {
                    tokenData = {
                        account: balance.mint,
                        amount: parseFloat(balance.uiTokenAmount.uiAmountString)
                    };
                    logger.debug(`Token data found: ${balance.mint}, Amount: ${balance.uiTokenAmount.uiAmountString}`);
                }
            }

            if (!tokenData || !solanaData) {
                logger.debug('Missing token or solana data, skipping...');
                return;
            }

            const solPrice = await this.getSolanaPrice();
            const usdValue = solanaData.amount * solPrice;

            const poolData = {
                tokenAccount: tokenData.account,
                tokenAmount: tokenData.amount,
                solanaAmount: solanaData.amount,
                usdValue,
                timestamp: new Date().toISOString(),
                txId: signature
            };

            // Calcola e aggiorna le metriche della pool
            const metrics = this.calculatePoolMetrics(poolData);
            const changes = this.updatePoolMetrics(signature, metrics);

            // Aggiungi le metriche e i cambiamenti ai dati della pool
            const enrichedPoolData = {
                ...poolData,
                metrics,
                changes
            };

            logger.info('Nuova Pool Rilevata', {
                tokenAddress: tokenData.account,
                solAmount: solanaData.amount,
                tokenAmount: tokenData.amount,
                usdValue,
                metrics: {
                    pricePerTokenSOL: metrics.pricePerTokenSOL,
                    pricePerTokenUSD: metrics.pricePerTokenUSD,
                    poolDepth: metrics.poolDepth,
                    normalizedLiquidity: metrics.normalizedLiquidity
                },
                ...(changes && { changes })
            });

            this.pools.set(signature, enrichedPoolData);
            logger.info(`Emitting new pool data to ${this.io.engine.clientsCount} clients`);
            this.io.emit('newPool', enrichedPoolData);

        } catch (error) {
            logger.error('Errore nella gestione della notifica:', error);
        }
    }

    getExistingPools() {
        return Array.from(this.pools.values());
    }

    async getSolanaPrice() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            this.solPrice = response.data.solana.usd;
            return this.solPrice;
        } catch (error) {
            logger.error('Errore nel recupero del prezzo Solana:', error);
            return this.solPrice || 0;
        }
    }

    async updateSolanaPrice() {
        this.solPrice = await this.getSolanaPrice();
    }

    startPriceUpdates() {
        // Aggiorna subito il prezzo
        this.getSolanaPrice();
        
        // Poi ogni 30 secondi
        setInterval(() => {
            this.getSolanaPrice();
        }, 30000);
    }
}

// Funzione per scrivere nei file di log
async function writeLogToFile(filename, message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    await fs.appendFile(path.join(__dirname, 'logs', filename), logMessage);
}

module.exports = LPTracker;
