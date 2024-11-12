const express = require('express');
const cors = require('cors');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const base58 = require('bs58');
const http = require('http');
const socketIo = require('socket.io');
const LPTracker = require('./lpTracker');
const { spawn } = require('child_process');
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

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Errore non gestito:', err);
    res.status(500).json({ 
        error: 'Errore interno del server',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        status: 'OK',
        socketConnections: io.engine.clientsCount,
        memoryUsage: process.memoryUsage()
    };
    res.json(health);
});

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
        const wallets = await loadWallets();
        res.json(wallets);
    } catch (error) {
        logger.error('Error getting wallets:', error);
        res.status(500).json({ error: 'Failed to get wallets' });
    }
});

app.get('/api/logs', (req, res) => {
    try {
        const logs = [...transactionLogs];
        transactionLogs.length = 0;
        res.json(logs);
    } catch (error) {
        logger.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

app.get('/api/my-wallet', async (req, res) => {
    try {
        if (!process.env.SOLANA_PRIVATE_KEY) {
            throw new Error('SOLANA_PRIVATE_KEY non trovata nel file .env');
        }

        const wallet = new SolanaWallet(process.env.SOLANA_PRIVATE_KEY);
        const balance = await wallet.getBalance();
        
        res.json({
            address: wallet.getWalletAddress(),
            balance: balance
        });
    } catch (error) {
        logger.error('Error getting personal wallet info:', error);
        res.status(500).json({ error: 'Failed to get wallet info' });
    }
});

// Endpoint per il ranking Coinbase
app.get('/api/coinbase-ranking', async (req, res) => {
    try {
        // Prima legge il file esistente
        const rankingPath = path.join(__dirname, 'coinbase_ranking.json');
        const fileExists = await fs.access(rankingPath).then(() => true).catch(() => false);

        if (fileExists) {
            const rankingData = await fs.readFile(rankingPath, 'utf8');
            const data = JSON.parse(rankingData);
            // Mappa il campo timestamp a lastUpdate per il frontend
            return res.json({
                ranking: data.ranking,
                lastUpdate: data.timestamp
            });
        }

        // Se il file non esiste, esegue lo scraping
        const pythonProcess = spawn('python3', ['coinbaseScraper.py'], {
            cwd: __dirname
        });

        let data = '';
        let error = '';

        pythonProcess.stdout.on('data', (chunk) => {
            data += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk) => {
            error += chunk.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                logger.error(`Errore nello scraping Coinbase: ${error}`);
                return res.status(500).json({ error: 'Failed to get Coinbase ranking' });
            }
            try {
                const rankingData = await fs.readFile(rankingPath, 'utf8');
                const data = JSON.parse(rankingData);
                // Mappa il campo timestamp a lastUpdate per il frontend
                res.json({
                    ranking: data.ranking,
                    lastUpdate: data.timestamp
                });
            } catch (e) {
                logger.error('Errore nel parsing del ranking:', e);
                res.status(500).json({ error: 'Invalid ranking data' });
            }
        });
    } catch (error) {
        logger.error('Error getting Coinbase ranking:', error);
        res.status(500).json({ error: 'Failed to get Coinbase ranking' });
    }
});

app.post('/api/wallets', async (req, res) => {
    try {
        const { wallet } = req.body;
        
        if (!wallet) {
            return res.status(400).json({ error: "Wallet address required" });
        }

        if (await startMonitoring(wallet)) {
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

        if (await stopMonitoring(wallet)) {
            return res.json({ message: "Wallet removed successfully" });
        }

        res.status(404).json({ error: "Wallet not found" });
    } catch (error) {
        logger.error('Error removing wallet:', error);
        res.status(500).json({ error: 'Failed to remove wallet' });
    }
});

// Variabili globali e classi
class SolanaWallet {
    constructor(privateKey) {
        this.wallet = Keypair.fromSecretKey(base58.decode(privateKey));
        this.endpoint = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    }

    async makeRpcCall(method, params) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params,
                }),
            });
            const data = await response.json();
            return data;
        } catch (error) {
            logger.error('Errore nella chiamata RPC:', error);
            throw error;
        }
    }

    async getBalance() {
        try {
            const params = [this.wallet.publicKey.toBase58(), { commitment: "confirmed" }];
            const response = await this.makeRpcCall("getBalance", params);
            if (response && response.result && response.result.value) {
                return response.result.value / 10**9;
            }
            return 0;
        } catch (error) {
            logger.error('Errore nel recupero del saldo:', error);
            throw error;
        }
    }

    getWalletAddress() {
        return this.wallet.publicKey.toBase58();
    }
}

const transactionLogs = [];
const monitorThreads = new Map();
const monitoredWallets = new Set();

async function loadWallets() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'wallets.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(path.join(__dirname, 'wallets.json'), '[]');
            return [];
        }
        throw error;
    }
}

async function saveWallets() {
    await fs.writeFile(
        path.join(__dirname, 'wallets.json'),
        JSON.stringify(Array.from(monitoredWallets))
    );
}

async function startMonitoring(wallet) {
    if (!monitorThreads.has(wallet)) {
        monitorThreads.set(wallet, true);
        monitoredWallets.add(wallet);
        await saveWallets();
        return true;
    }
    return false;
}

async function stopMonitoring(wallet) {
    if (monitorThreads.has(wallet)) {
        monitorThreads.delete(wallet);
        monitoredWallets.delete(wallet);
        await saveWallets();
        return true;
    }
    return false;
}

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM ricevuto. Avvio shutdown graceful...');
    lpTracker.stop();
    server.close(() => {
        logger.info('Server HTTP chiuso.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT ricevuto. Avvio shutdown graceful...');
    lpTracker.stop();
    server.close(() => {
        logger.info('Server HTTP chiuso.');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Eccezione non gestita:', error);
    lpTracker.stop();
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
        if (!process.env.SOLANA_PRIVATE_KEY) {
            throw new Error('SOLANA_PRIVATE_KEY non trovata nel file .env');
        }
        await loadWallets();
        
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
