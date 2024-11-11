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
        
        // Inizializza il wallet personale dalla chiave privata
        if (process.env.SOLANA_PRIVATE_KEY) {
            try {
                const privateKeyBytes = base58.decode(process.env.SOLANA_PRIVATE_KEY);
                const keypair = Keypair.fromSecretKey(privateKeyBytes);
                this.personalWallet = keypair.publicKey.toString();
                logger.info(`Wallet personale inizializzato: ${this.personalWallet}`);
            } catch (error) {
                logger.error('Errore durante l\'inizializzazione del wallet personale:', error);
                this.personalWallet = '';
            }
        } else {
            this.personalWallet = '';
            logger.warn('Nessuna chiave privata configurata per il wallet personale');
        }
    }

    async loadWallets() {
        try {
            const walletsPath = path.join(__dirname, 'wallets.json');
            const data = await fs.readFile(walletsPath, 'utf8');
            const wallets = JSON.parse(data);
            
            // Inizializza il monitoraggio per ogni wallet caricato
            for (const wallet of wallets) {
                await this.startMonitoring(wallet);
            }
            
            logger.info(`Caricati ${wallets.length} wallet dal file di configurazione`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Se il file non esiste, lo creiamo con un array vuoto
                await fs.writeFile(path.join(__dirname, 'wallets.json'), '[]');
                logger.info('Creato nuovo file wallets.json');
            } else {
                logger.error('Errore durante il caricamento dei wallet:', error);
                throw error;
            }
        }
    }

    async getPersonalWalletInfo() {
        if (!this.personalWallet) {
            logger.warn('Nessun wallet personale configurato');
            return { address: '', balance: 0 };
        }

        try {
            const publicKey = new PublicKey(this.personalWallet);
            const accountInfo = await this.connection.getAccountInfo(publicKey);
            const balance = accountInfo ? accountInfo.lamports / 10**9 : 0;

            logger.info(`Informazioni wallet personale recuperate. Balance: ${balance} SOL`);
            return {
                address: this.personalWallet,
                balance
            };
        } catch (error) {
            logger.error('Errore durante il recupero delle informazioni del wallet personale:', error);
            return { address: this.personalWallet, balance: 0 };
        }
    }

    async startMonitoring(wallet) {
        if (this.monitoredWallets.has(wallet)) {
            return false;
        }

        try {
            // Verifica che l'indirizzo del wallet sia valido
            new PublicKey(wallet);
            
            this.monitoredWallets.add(wallet);
            await this.saveWallets();
            logger.info(`Iniziato monitoraggio per il wallet: ${wallet}`);
            return true;
        } catch (error) {
            logger.error(`Errore durante l'avvio del monitoraggio per il wallet ${wallet}:`, error);
            return false;
        }
    }

    async stopMonitoring(wallet) {
        if (!this.monitoredWallets.has(wallet)) {
            return false;
        }

        this.monitoredWallets.delete(wallet);
        await this.saveWallets();
        logger.info(`Interrotto monitoraggio per il wallet: ${wallet}`);
        return true;
    }

    async saveWallets() {
        try {
            const walletsPath = path.join(__dirname, 'wallets.json');
            const walletsArray = Array.from(this.monitoredWallets);
            await fs.writeFile(walletsPath, JSON.stringify(walletsArray, null, 2));
            logger.info('Wallet salvati con successo');
        } catch (error) {
            logger.error('Errore durante il salvataggio dei wallet:', error);
            throw error;
        }
    }

    stop() {
        this.isRunning = false;
        // Chiudi tutte le sottoscrizioni attive
        for (const [wallet, subscription] of this.walletSubscriptions) {
            if (subscription) {
                subscription.unsubscribe();
            }
        }
        this.walletSubscriptions.clear();
        logger.info('Monitor dei wallet arrestato');
    }
}

const walletMonitor = new WalletMonitor(io);

// Routes
app.get('/api/my-wallet', async (req, res) => {
    try {
        const walletInfo = await walletMonitor.getPersonalWalletInfo();
        res.json(walletInfo);
    } catch (error) {
        logger.error('Error getting personal wallet info:', error);
        res.status(500).json({ error: 'Failed to get personal wallet info' });
    }
});

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
