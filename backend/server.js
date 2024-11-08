const express = require('express');
const cors = require('cors');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const base58 = require('bs58');
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
        new winston.transports.Console()
    ]
});

const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

// Middleware per logging delle richieste
app.use((req, res, next) => {
    logger.debug('=== Nuova Richiesta ===');
    logger.debug(`Metodo: ${req.method}`);
    logger.debug(`URL: ${req.url}`);
    logger.debug(`Headers: ${JSON.stringify(req.headers)}`);
    if (req.body) {
        logger.debug(`Body: ${JSON.stringify(req.body)}`);
    }
    logger.debug('===================');
    next();
});

app.options('*', cors());

// Gestione errori globale
app.use((err, req, res, next) => {
    logger.error('=== Errore ===');
    logger.error(`Tipo: ${err.name}`);
    logger.error(`Messaggio: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    logger.error('=============');
    res.status(500).json({ error: err.message });
});

class SolanaWallet {
    constructor(privateKey) {
        this.wallet = Keypair.fromSecretKey(base58.decode(privateKey));
        this.endpoint = "https://api.mainnet-beta.solana.com";
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
            logger.error(`Errore nella chiamata RPC: ${error}`);
            return null;
        }
    }

    async getBalance() {
        try {
            const params = [this.wallet.publicKey.toBase58(), { commitment: "confirmed" }];
            const response = await this.makeRpcCall("getBalance", params);
            if (response && response.result && response.result.value) {
                return response.result.value / 10**9; // Converti da lamports a SOL
            }
            return 0;
        } catch (error) {
            logger.error(`Errore nel recupero del saldo: ${error}`);
            return 0;
        }
    }

    getWalletAddress() {
        return this.wallet.publicKey.toBase58();
    }
}

// Variabili globali
const transactionLogs = [];
const monitorThreads = new Map();
const monitoredWallets = new Set();

async function loadWallets() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'wallets.json'), 'utf8');
        const wallets = JSON.parse(data);
        for (const wallet of wallets) {
            await startMonitoring(wallet);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(path.join(__dirname, 'wallets.json'), '[]');
        } else {
            throw error;
        }
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

// Routes
app.get('/api/wallets', (req, res) => {
    logger.info("GET /api/wallets richiesto");
    res.json(Array.from(monitoredWallets));
});

app.post('/api/wallets', async (req, res) => {
    logger.info(`POST /api/wallets richiesto con dati: ${JSON.stringify(req.body)}`);
    const { wallet } = req.body;
    
    if (!wallet) {
        logger.error("Tentativo di aggiungere wallet senza indirizzo");
        return res.status(400).json({ error: "Wallet address required" });
    }

    if (await startMonitoring(wallet)) {
        logger.info(`Wallet ${wallet} aggiunto con successo`);
        return res.json({ message: "Wallet added successfully" });
    }

    logger.warning(`Tentativo di aggiungere wallet ${wallet} già monitorato`);
    res.status(400).json({ error: "Wallet already monitored" });
});

app.delete('/api/wallets/:wallet', async (req, res) => {
    const { wallet } = req.params;
    logger.info(`DELETE /api/wallets/${wallet} richiesto`);

    if (await stopMonitoring(wallet)) {
        logger.info(`Wallet ${wallet} rimosso con successo`);
        return res.json({ message: "Wallet removed successfully" });
    }

    logger.warning(`Tentativo di rimuovere wallet ${wallet} non trovato`);
    res.status(404).json({ error: "Wallet not found" });
});

app.get('/api/logs', (req, res) => {
    logger.info("GET /api/logs richiesto");
    const logs = [...transactionLogs];
    transactionLogs.length = 0;
    res.json(logs);
});

app.get('/api/my-wallet', async (req, res) => {
    logger.info("GET /api/my-wallet richiesto");
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
        logger.error(`Error getting personal wallet info: ${error}`);
        res.status(500).json({ error: 'Failed to get wallet info' });
    }
});

// Gestione graceful shutdown
function setupGracefulShutdown(server) {
    async function shutdown() {
        logger.info('Avvio shutdown graceful...');
        
        // Ferma il monitoraggio di tutti i wallet
        for (const wallet of monitoredWallets) {
            await stopMonitoring(wallet);
        }
        
        // Chiudi il server
        server.close(() => {
            logger.info('Server HTTP chiuso.');
            process.exit(0);
        });
        
        // Se il server non si chiude entro 10 secondi, forza la chiusura
        setTimeout(() => {
            logger.error('Shutdown forzato dopo timeout');
            process.exit(1);
        }, 10000);
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Avvio del server
const PORT = 5001;

async function startServer() {
    try {
        if (!process.env.SOLANA_PRIVATE_KEY) {
            throw new Error('SOLANA_PRIVATE_KEY non trovata nel file .env');
        }
        await loadWallets();
        
        const server = app.listen(PORT, () => {
            logger.info(`Server in esecuzione sulla porta ${PORT}`);
        });
        
        setupGracefulShutdown(server);
    } catch (error) {
        logger.error(`Errore durante l'avvio del server: ${error}`);
        process.exit(1);
    }
}

startServer();
