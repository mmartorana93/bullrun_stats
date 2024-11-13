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
const axios = require('axios');
require('dotenv').config();

// Cache per la dominanza Bitcoin
let btcDominanceCache = {
    data: null,
    lastUpdate: 0
};

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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
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

// Funzione per recuperare la dominanza Bitcoin con cache
async function getBitcoinDominance() {
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

    try {
        // Se abbiamo dati in cache validi, li restituiamo
        if (btcDominanceCache.data && (now - btcDominanceCache.lastUpdate) < CACHE_DURATION) {
            logger.info('Returning cached BTC dominance data:', btcDominanceCache.data);
            return btcDominanceCache.data;
        }

        // Altrimenti facciamo una nuova richiesta
        logger.info('Fetching new BTC dominance data from CoinGecko');
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        logger.info('CoinGecko response:', response.data);

        const btcDominance = response.data.data.market_cap_percentage.btc;
        
        btcDominanceCache = {
            data: {
                btcDominance: btcDominance,
                lastUpdate: new Date().toISOString()
            },
            lastUpdate: now
        };

        logger.info('New BTC dominance data cached:', btcDominanceCache.data);
        return btcDominanceCache.data;
    } catch (error) {
        logger.error('Error in getBitcoinDominance:', error);
        throw error;
    }
}

// Endpoint per la dominanza Bitcoin con gestione cache
app.get('/api/bitcoin-dominance', async (req, res) => {
    try {
        const data = await getBitcoinDominance();
        logger.info('Sending BTC dominance data:', data);
        res.json(data);
    } catch (error) {
        logger.error('Error fetching Bitcoin dominance:', error);
        // Se abbiamo dati in cache, li restituiamo anche se sono scaduti
        if (btcDominanceCache.data) {
            logger.info('Returning expired cache data:', btcDominanceCache.data);
            return res.json(btcDominanceCache.data);
        }
        res.status(500).json({ error: 'Failed to fetch Bitcoin dominance' });
    }
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
        const force = req.query.force === 'true';
        const { spawn } = require('child_process');
        const python = spawn('python3', ['coinbaseScraper.py', force ? '--force' : '']);
        
        let data = '';
        
        python.stdout.on('data', (chunk) => {
            data += chunk;
        });

        python.stderr.on('data', (data) => {
            logger.error(`Error from Python script: ${data}`);
        });

        python.on('close', async (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Failed to fetch ranking' });
            }

            try {
                const storedData = await fs.readFile('coinbase_ranking.json', 'utf8');
                const parsedData = JSON.parse(storedData);
                res.json(parsedData);
            } catch (error) {
                logger.error('Error reading ranking file:', error);
                res.status(500).json({ error: 'Failed to read ranking data' });
            }
        });
    } catch (error) {
        logger.error('Error in coinbase ranking endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
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

// Modifica la durata della cache a 60 secondi
const CACHE_DURATION = 60000; // 60 secondi
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 secondi tra i retry

async function fetchWithRetry(url, retries = 0) {
  try {
    const response = await axios.get(url, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 429 && retries < MAX_RETRIES) {
      logger.warn(`Rate limit hit, retrying in ${RETRY_DELAY}ms... (${retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, retries + 1);
    }
    throw error;
  }
}

// Aggiungi una cache di fallback
const FALLBACK_CACHE_FILE = path.join(__dirname, 'cache/crypto_data.json');

// Funzione per salvare i dati nella cache di fallback
async function saveFallbackCache(data) {
  try {
    await fs.mkdir(path.dirname(FALLBACK_CACHE_FILE), { recursive: true });
    await fs.writeFile(FALLBACK_CACHE_FILE, JSON.stringify(data));
    logger.info('Fallback cache saved successfully');
  } catch (error) {
    logger.error('Error saving fallback cache:', error);
  }
}

// Funzione per leggere i dati dalla cache di fallback
async function loadFallbackCache() {
  try {
    const data = await fs.readFile(FALLBACK_CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error loading fallback cache:', error);
    return null;
  }
}

// Modifica updateAllData per usare il fallback
async function updateAllData() {
  if (cache.updating) return cache.data;
  
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
    logger.info('Serving cached data');
    return cache.data;
  }

  try {
    cache.updating = true;
    logger.info('Fetching fresh data from CoinGecko');
    
    const [globalData, defiData, tetherData] = await Promise.all([
      fetchWithRetry('https://api.coingecko.com/api/v3/global'),
      fetchWithRetry('https://api.coingecko.com/api/v3/global/decentralized_finance_defi'),
      fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_market_cap=true')
    ]);

    const newData = {
      global: globalData,
      defi: defiData,
      tether: tetherData,
      timestamp: now
    };

    cache.data = newData;
    cache.timestamp = now;
    
    // Salva i dati nella cache di fallback
    await saveFallbackCache(newData);
    
    logger.info('Data successfully updated');
    return newData;
  } catch (error) {
    logger.error('Error updating data:', error);
    
    // Prova a usare la cache in memoria
    if (cache.data) {
      logger.info('Using memory cache');
      return cache.data;
    }
    
    // Se non c'è cache in memoria, usa il fallback
    logger.info('Trying fallback cache');
    const fallbackData = await loadFallbackCache();
    if (fallbackData) {
      logger.info('Using fallback cache');
      return fallbackData;
    }
    
    return null;
  } finally {
    cache.updating = false;
  }
}

// Un solo endpoint per tutti i dati
app.get('/api/crypto/all', async (req, res) => {
  try {
    const data = await updateAllData();
    if (!data) {
      return res.status(500).json({ error: 'No data available' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error serving data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aggiorna i dati ogni 30 secondi
setInterval(updateAllData, CACHE_DURATION);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running' });
});
