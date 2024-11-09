const WebSocket = require('ws');
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');
const winston = require('winston');

// Configurazione logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'lptracker-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'lptracker.log' })
    ]
});

const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const TARGET_INSTRUCTION = "initialize2";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const HEALTH_CHECK_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;

class LPTracker {
    constructor(io) {
        logger.info('Initializing LP Tracker');
        this.io = io;
        this.connection = new Connection(RPC_URL);
        this.solPrice = 0;
        this.wsConnection = null;
        this.pools = [];
        this.isReconnecting = false;
        this.retryCount = 0;
        this.healthCheckInterval = null;
        this.connectionTimeout = null;
        this.activeClients = new Set();
        
        // Gestione eventi Socket.io
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            this.activeClients.add(socket.id);
            
            // Invia le pool esistenti al client quando si connette
            socket.emit('existingPools', this.pools);
            
            socket.on('getPools', () => {
                socket.emit('existingPools', this.pools);
            });

            socket.on('heartbeat', () => {
                socket.emit('pong');
            });

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
                this.activeClients.delete(socket.id);
            });
        });

        this.updateSolanaPrice();
        setInterval(() => this.updateSolanaPrice(), 60000);
    }

    async updateSolanaPrice() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            this.solPrice = response.data.solana.usd;
            logger.info(`Updated Solana price: $${this.solPrice}`);
        } catch (error) {
            logger.error('Failed to fetch Solana price:', error);
        }
    }

    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
                this.wsConnection.ping();
            } else {
                logger.warn('Health check failed - WebSocket not connected');
                this.reconnect();
            }
        }, HEALTH_CHECK_INTERVAL);
    }

    async checkRugcheck(contractAddress) {
        try {
            logger.debug(`Checking Rugcheck for contract: ${contractAddress}`);
            const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${contractAddress}/report`, {
                timeout: 5000,
                retry: 3,
                retryDelay: 1000
            });
            if (response.status === 200) {
                logger.debug(`Rugcheck response received for ${contractAddress}`);
                return response.data.risks || [];
            }
        } catch (error) {
            logger.error(`Failed to fetch Rugcheck report for ${contractAddress}:`, error);
        }
        return null;
    }

    analyzeRisks(risks) {
        if (!risks) return null;

        logger.debug('Analyzing risks:', risks);
        const riskFlags = {
            mutable_metadata: false,
            freeze_authority_enabled: false,
            mint_authority_enabled: false
        };

        risks.forEach(risk => {
            switch (risk.name) {
                case "Mutable metadata":
                    riskFlags.mutable_metadata = true;
                    break;
                case "Freeze Authority still enabled":
                    riskFlags.freeze_authority_enabled = true;
                    break;
                case "Mint Authority still enabled":
                    riskFlags.mint_authority_enabled = true;
                    break;
            }
        });

        const isSafeToBuy = !Object.values(riskFlags).some(flag => flag);
        logger.debug(`Risk analysis complete. Safe to buy: ${isSafeToBuy}`);
        return { flags: riskFlags, isSafeToBuy };
    }

    async handleTransaction(txId) {
        try {
            logger.debug(`Processing transaction: ${txId}`);
            const tx = await this.connection.getTransaction(txId, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.postTokenBalances) {
                logger.warn(`Invalid transaction data for ${txId}`);
                return null;
            }

            const postTokenBalances = tx.meta.postTokenBalances;
            let tokenData = {
                tokenAccount: null,
                tokenAmount: 0,
                solanaAccount: null,
                solanaAmount: 0
            };

            postTokenBalances.forEach(balance => {
                if (balance.accountIndex === 5) {
                    tokenData.tokenAccount = balance.mint;
                    tokenData.tokenAmount = parseFloat(balance.uiTokenAmount.uiAmountString);
                    logger.debug(`Token data found: ${balance.mint}, Amount: ${tokenData.tokenAmount}`);
                } else if (balance.accountIndex === 6) {
                    tokenData.solanaAccount = balance.mint;
                    tokenData.solanaAmount = parseFloat(balance.uiTokenAmount.uiAmountString);
                    logger.debug(`Solana data found: ${balance.mint}, Amount: ${tokenData.solanaAmount}`);
                }
            });

            if (tokenData.tokenAccount && tokenData.solanaAccount) {
                const usdValue = tokenData.solanaAmount * this.solPrice;
                logger.info(`New pool detected - USD Value: $${usdValue}`);
                
                // Analizza i rischi per tutti i pool
                const risks = await this.checkRugcheck(tokenData.tokenAccount);
                const riskAnalysis = this.analyzeRisks(risks);

                const poolData = {
                    ...tokenData,
                    usdValue,
                    timestamp: new Date(),
                    txId,
                    riskAnalysis
                };

                // Aggiungi il pool alla lista e mantieni gli ultimi 100
                this.pools.unshift(poolData);
                if (this.pools.length > 100) {
                    this.pools = this.pools.slice(0, 100);
                }

                // Invia il nuovo pool a tutti i client connessi
                if (this.activeClients.size > 0) {
                    logger.info(`Emitting new pool data to ${this.activeClients.size} clients`);
                    this.io.emit('newPool', poolData);
                }
            }
        } catch (error) {
            logger.error('Error handling transaction:', error);
        }
    }

    calculateBackoff() {
        if (this.retryCount >= MAX_RETRIES) return null;
        return Math.min(BASE_DELAY * Math.pow(2, this.retryCount), 30000);
    }

    reconnect() {
        if (this.isReconnecting) {
            logger.debug('Already attempting to reconnect');
            return;
        }

        const backoffDelay = this.calculateBackoff();
        if (backoffDelay === null) {
            logger.error('Max retry attempts reached');
            return;
        }

        this.isReconnecting = true;
        this.retryCount++;

        logger.info(`Attempting reconnection in ${backoffDelay}ms (attempt ${this.retryCount}/${MAX_RETRIES})`);
        setTimeout(() => {
            this.isReconnecting = false;
            this.start();
        }, backoffDelay);
    }

    start() {
        logger.info('Starting LP Tracker WebSocket connection');
        if (this.wsConnection) {
            this.wsConnection.terminate();
        }

        this.wsConnection = new WebSocket('wss://api.mainnet-beta.solana.com');

        // Timeout per la connessione iniziale
        this.connectionTimeout = setTimeout(() => {
            if (this.wsConnection.readyState !== WebSocket.OPEN) {
                logger.error('Connection timeout - forcing reconnect');
                this.wsConnection.terminate();
                this.reconnect();
            }
        }, CONNECTION_TIMEOUT);

        this.wsConnection.on('open', () => {
            logger.info('WebSocket connected');
            clearTimeout(this.connectionTimeout);
            this.isReconnecting = false;
            this.retryCount = 0;
            this.startHealthCheck();

            this.wsConnection.send(JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'logsSubscribe',
                params: [
                    { mentions: [RAYDIUM_PROGRAM_ID] },
                    { commitment: 'confirmed' }
                ]
            }));
        });

        this.wsConnection.on('message', async (data) => {
            try {
                const message = JSON.parse(data);
                if (message.method === 'logsNotification') {
                    const logs = message.params.result.value.logs;
                    if (logs.some(log => log.includes(TARGET_INSTRUCTION))) {
                        logger.debug('New initialize2 instruction detected');
                        const txId = message.params.result.value.signature;
                        await this.handleTransaction(txId);
                    }
                }
            } catch (error) {
                logger.error('Error processing message:', error);
            }
        });

        this.wsConnection.on('close', (code, reason) => {
            logger.warn(`WebSocket disconnected (${code}): ${reason}`);
            clearTimeout(this.connectionTimeout);
            clearInterval(this.healthCheckInterval);
            this.reconnect();
        });

        this.wsConnection.on('error', (error) => {
            logger.error('WebSocket error:', error);
            clearTimeout(this.connectionTimeout);
            clearInterval(this.healthCheckInterval);
            this.wsConnection.terminate();
            this.reconnect();
        });

        this.wsConnection.on('pong', () => {
            logger.debug('Received pong from server');
        });
    }

    stop() {
        logger.info('Stopping LP Tracker');
        clearTimeout(this.connectionTimeout);
        clearInterval(this.healthCheckInterval);
        if (this.wsConnection) {
            this.wsConnection.terminate();
            this.wsConnection = null;
        }
    }
}

module.exports = LPTracker;
