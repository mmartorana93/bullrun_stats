require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Assicurati che il file .env esista
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
    console.warn('.env file non trovato, uso valori di default');
}

const determineNetwork = (url) => {
    if (url.includes('devnet')) return 'devnet';
    if (url.includes('testnet')) return 'testnet';
    return 'mainnet';
};

const config = {
    // RPC Endpoints
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    SOLANA_WS_URL: process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com",
    
    // Server Config
    PORT: process.env.PORT || 5001,
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    
    // Feature Flags
    ENABLE_LP_TRACKING: process.env.ENABLE_LP_TRACKING === 'false',
    
    // Monitoring Config
    MAX_MONITORED_WALLETS: parseInt(process.env.MAX_MONITORED_WALLETS || '50'),
    TRANSACTION_HISTORY_LIMIT: parseInt(process.env.TRANSACTION_HISTORY_LIMIT || '100'),
    
    // RPC Fallbacks
    BACKUP_RPC_URLS: [
        "https://solana-api.projectserum.com",
        "https://rpc.ankr.com/solana"
    ],

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Determina e logga la rete in uso
const network = determineNetwork(config.SOLANA_RPC_URL);
console.log(`\x1b[33m[Network Configuration]\x1b[0m Connecting to Solana ${network}`);
config.NETWORK = network;

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
