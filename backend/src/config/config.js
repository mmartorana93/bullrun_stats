require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Assicurati che il file .env esista
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
    console.warn('.env file non trovato, uso valori di default');
}

const config = {
    // RPC Endpoints
    SOLANA_RPC_URL: process.env.SOLANA_MAINNET_RPC || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    SOLANA_WS_URL: process.env.SOLANA_MAINNET_WS || process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com",
    
    // Server Config
    PORT: process.env.PORT || 5001,
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    
    // Feature Flags
    ENABLE_TEST_FEATURES: process.env.ENABLE_TEST_FEATURES === 'true',
    
    // Monitoring Config
    MAX_MONITORED_WALLETS: parseInt(process.env.MAX_MONITORED_WALLETS || '50'),
    TRANSACTION_HISTORY_LIMIT: parseInt(process.env.TRANSACTION_HISTORY_LIMIT || '100'),
    
    // RPC Fallbacks (in caso di problemi con l'endpoint principale)
    BACKUP_RPC_URLS: [
        "https://solana-api.projectserum.com",
        "https://rpc.ankr.com/solana"
    ],

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/app.log'),

    // WebSocket
    WS_PING_INTERVAL: parseInt(process.env.WS_PING_INTERVAL || '25000'),
    WS_PING_TIMEOUT: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
    WS_CONNECT_TIMEOUT: parseInt(process.env.WS_CONNECT_TIMEOUT || '10000'),

    // Transaction Monitoring
    TX_CONFIRMATION_TIMEOUT: parseInt(process.env.TX_CONFIRMATION_TIMEOUT || '60000'),
    TX_RETRY_ATTEMPTS: parseInt(process.env.TX_RETRY_ATTEMPTS || '3'),
    TX_RETRY_DELAY: parseInt(process.env.TX_RETRY_DELAY || '1000'),

    // Cache Settings
    CACHE_DURATION: parseInt(process.env.CACHE_DURATION || '300000'), // 5 minuti
    MAX_CACHE_ITEMS: parseInt(process.env.MAX_CACHE_ITEMS || '1000'),

    // Rate Limiting
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minuti
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),

    // Security
    CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ["http://localhost:3000"],
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h'
};

// Validazione della configurazione
const validateConfig = () => {
    if (!config.SOLANA_RPC_URL) {
        throw new Error('SOLANA_RPC_URL è richiesto');
    }
    if (!config.SOLANA_WS_URL) {
        throw new Error('SOLANA_WS_URL è richiesto');
    }
    // Altre validazioni...
};

try {
    validateConfig();
} catch (error) {
    console.error('Errore nella configurazione:', error.message);
    process.exit(1);
}

module.exports = config; 