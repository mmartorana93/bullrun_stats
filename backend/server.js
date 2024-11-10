const express = require('express');
const cors = require('cors');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { Keypair, Connection, PublicKey } = require('@solana/web3.js');
const base58 = require('bs58');
const http = require('http');
const socketIo = require('socket.io');
const LPTracker = require('./lpTracker');
require('dotenv').config();

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
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Middleware per il logging delle richieste HTTP
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
};

const app = express();
const server = http.createServer(app);

// Configurazione Socket.IO con gestione degli errori e timeout
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 10000,
    transports: ['websocket']
});

// Inizializza LP Tracker
const lpTracker = new LPTracker(io);

// Configurazione CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(requestLogger);

// Gestione WebSocket per il monitoraggio dei wallet
class WalletMonitor {
    constructor(io) {
        this.io = io;
        this.walletSubscriptions = new Map();
        this.monitoredWallets = new Set();
        this.connection = new Connection(
            process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
            'confirmed'
        );
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 10;
        this.isRunning = true;
    }

    async startMonitoring(wallet) {
        if (this.walletSubscriptions.has(wallet)) {
            return false;
        }

        try {
            const publicKey = new PublicKey(wallet);
            
            // Sottoscrizione al websocket per il saldo con gestione della riconnessione
            const setupBalanceSubscription = async () => {
                try {
                    const balanceSubscriptionId = this.connection.onAccountChange(
                        publicKey,
                        (accountInfo) => {
                            const balance = accountInfo.lamports / 10**9;
                            this.io.emit('walletUpdate', {
                                wallet,
                                type: 'balance',
                                balance
                            });
                            // Reset tentativi di riconnessione dopo successo
                            this.reconnectAttempts.set(wallet, 0);
                        },
                        'confirmed'
                    );
                    return balanceSubscriptionId;
                } catch (error) {
                    logger.error(`Errore nella sottoscrizione del saldo per ${wallet}:`, error);
                    await this.handleReconnect(wallet, setupBalanceSubscription);
                    return null;
                }
            };

            // Sottoscrizione al websocket per le transazioni con gestione della riconnessione
            const setupSignatureSubscription = async () => {
                try {
                    const signatureSubscriptionId = this.connection.onSignature(
                        publicKey,
                        async (signature, context) => {
                            try {
                                const transaction = await this.connection.getTransaction(signature, {
                                    commitment: 'confirmed',
                                    maxSupportedTransactionVersion: 0
                                });

                                if (transaction) {
                                    this.io.emit('walletUpdate', {
                                        wallet,
                                        type: 'transaction',
                                        transaction: {
                                            signature,
                                            timestamp: transaction.blockTime,
                                            amount: transaction.meta?.postBalances[0] - transaction.meta?.preBalances[0],
                                            type: transaction.meta?.postBalances[0] > transaction.meta?.preBalances[0] ? 'credit' : 'debit'
                                        }
                                    });
                                }
                                // Reset tentativi di riconnessione dopo successo
                                this.reconnectAttempts.set(wallet, 0);
                            } catch (error) {
                                logger.error(`Errore nel recupero della transazione per ${wallet}:`, error);
                            }
                        },
                        'confirmed'
                    );
                    return signatureSubscriptionId;
                } catch (error) {
                    logger.error(`Errore nella sottoscrizione delle transazioni per ${wallet}:`, error);
                    await this.handleReconnect(wallet, setupSignatureSubscription);
                    return null;
                }
            };

            const balanceSubscriptionId = await setupBalanceSubscription();
            const signatureSubscriptionId = await setupSignatureSubscription();

            if (balanceSubscriptionId && signatureSubscriptionId) {
                this.walletSubscriptions.set(wallet, {
                    balanceSubscriptionId,
                    signatureSubscriptionId
                });

                this.monitoredWallets.add(wallet);
                await this.saveWallets();
                
                // Invia il saldo iniziale
                const accountInfo = await this.connection.getAccountInfo(publicKey);
                if (accountInfo) {
                    const balance = accountInfo.lamports / 10**9;
                    this.io.emit('walletUpdate', {
                        wallet,
                        type: 'balance',
                        balance
                    });
                }

                return true;
            }

            return false;
        } catch (error) {
            logger.error(`Errore nel monitoraggio del wallet ${wallet}:`, error);
            return false;
        }
    }

    async handleReconnect(wallet, setupFunction) {
        const attempts = this.reconnectAttempts.get(wallet) || 0;
        
        if (attempts < this.maxReconnectAttempts && this.isRunning) {
            this.reconnectAttempts.set(wallet, attempts + 1);
            const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
            logger.info(`Tentativo di riconnessione ${attempts + 1} per ${wallet} in ${delay}ms`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return setupFunction();
        } else {
            logger.error(`Numero massimo di tentativi di riconnessione raggiunto per ${wallet}`);
            return null;
        }
    }

    async stopMonitoring(wallet) {
        const subscriptions = this.walletSubscriptions.get(wallet);
        if (subscriptions) {
            try {
                this.connection.removeAccountChangeListener(subscriptions.balanceSubscriptionId);
                this.connection.removeSignatureListener(subscriptions.signatureSubscriptionId);
                this.walletSubscriptions.delete(wallet);
                this.monitoredWallets.delete(wallet);
                await this.saveWallets();
                return true;
            } catch (error) {
                logger.error(`Errore nella rimozione del monitoraggio per il wallet ${wallet}:`, error);
                return false;
            }
        }
        return false;
    }

    async loadWallets() {
        try {
            const data = await fs.readFile(path.join(__dirname, 'wallets.json'), 'utf8');
            const wallets = JSON.parse(data);
            for (const wallet of wallets) {
                await this.startMonitoring(wallet);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(path.join(__dirname, 'wallets.json'), '[]');
            } else {
                throw error;
            }
        }
    }

    async saveWallets() {
        await fs.writeFile(
            path.join(__dirname, 'wallets.json'),
            JSON.stringify(Array.from(this.monitoredWallets))
        );
    }

    stop() {
        this.isRunning = false;
        for (const [wallet, subscriptions] of this.walletSubscriptions) {
            this.connection.removeAccountChangeListener(subscriptions.balanceSubscriptionId);
            this.connection.removeSignatureListener(subscriptions.signatureSubscriptionId);
        }
        this.walletSubscriptions.clear();
    }
}

const walletMonitor = new WalletMonitor(io);

// Routes
app.get('/api/solana-price', (req, res) => {
    try {
        const price = lpTracker.solPrice || 0;
        logger.info(`Sending Solana price: $${price}`);
        res.json({ price });
    } catch (error) {
        logger.error('Error getting Solana price:', error);
        res.status(500).json({ error: 'Failed to get Solana price' });
    }
});

app.get('/api/wallets', async (req, res) => {
    try {
        const wallets = Array.from(walletMonitor.monitoredWallets);
        res.json(wallets);
    } catch (error) {
        logger.error('Error getting wallets:', error);
        res.status(500).json({ error: 'Failed to get wallets' });
    }
});

app.post('/api/wallets', async (req, res) => {
    try {
        const { wallet } = req.body;
        
        if (!wallet) {
            return res.status(400).json({ error: "Wallet address required" });
        }

        if (await walletMonitor.startMonitoring(wallet)) {
            return res.json({ message: "Wallet added successfully" });
        }

        res.status(400).json({ error: "Wallet already monitored" });
    } catch (error) {
        logger.error('Error adding wallet:', error);
        res.status(500).json({ error: 'Failed to add wallet' });
    }
});

app.delete('/api/wallets/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;

        if (await walletMonitor.stopMonitoring(wallet)) {
            return res.json({ message: "Wallet removed successfully" });
        }

        res.status(404).json({ error: "Wallet not found" });
    } catch (error) {
        logger.error('Error removing wallet:', error);
        res.status(500).json({ error: 'Failed to remove wallet' });
    }
});

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM ricevuto. Avvio shutdown graceful...');
    lpTracker.stop();
    walletMonitor.stop();
    server.close(() => {
        logger.info('Server HTTP chiuso.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT ricevuto. Avvio shutdown graceful...');
    lpTracker.stop();
    walletMonitor.stop();
    server.close(() => {
        logger.info('Server HTTP chiuso.');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Eccezione non gestita:', error);
    lpTracker.stop();
    walletMonitor.stop();
    server.close(() => {
        logger.info('Server HTTP chiuso dopo eccezione non gestita.');
        process.exit(1);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Rejection non gestita:', reason);
});

// Avvio del server
const PORT = process.env.PORT || 5001;

async function startServer() {
    try {
        await walletMonitor.loadWallets();
        
        server.listen(PORT, () => {
            logger.info(`Server in esecuzione sulla porta ${PORT}`);
            lpTracker.start();
        });
    } catch (error) {
        logger.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    }
}

startServer();
