require('dotenv').config();
const http = require('http');
const { logger, ensureLogDirectory } = require('./src/config/logger');
const setupExpress = require('./src/config/express');
const SocketManager = require('./src/websocket/socketManager');
const initializeWalletRoutes = require('./src/routes/walletRoutes');
const cryptoRoutes = require('./src/routes/cryptoRoutes');
const logRoutes = require('./src/routes/logRoutes');
const cryptoService = require('./src/services/cryptoService');
const walletService = require('./src/services/walletService');
const LPTracker = require('./lpTracker');

// Inizializza l'app Express
const app = setupExpress();

// Crea il server HTTP
const server = http.createServer(app);

// Inizializza Socket.IO
const socketManager = new SocketManager(server);

// Inizializza LP Tracker e rendilo disponibile globalmente
global.lpTracker = new LPTracker(socketManager.io);

// Assicurati che la directory dei log esista
ensureLogDirectory();

// Configura le routes
app.use('/api/wallets', initializeWalletRoutes(socketManager));
app.use('/api/crypto', cryptoRoutes);
app.use('/api/logs', logRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        status: 'OK',
        socketConnections: socketManager.io.engine.clientsCount,
        memoryUsage: process.memoryUsage()
    };
    res.json(health);
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Gestione graceful shutdown
async function gracefulShutdown(signal) {
    logger.info(`${signal} ricevuto. Avvio shutdown graceful...`);
    
    if (global.lpTracker) {
        global.lpTracker.stop();
    }
    
    server.close(() => {
        logger.info('Server HTTP chiuso.');
        process.exit(0);
    });
}

// Gestione dei segnali di shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestione errori non catturati
process.on('uncaughtException', (error) => {
    logger.error('Eccezione non gestita:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Rejection non gestita:', reason);
});

// Avvio del server
const PORT = process.env.PORT || 5001;

async function startServer() {
    try {
        // Carica i wallet salvati
        const savedWallets = await walletService.loadWallets();
        for (const wallet of savedWallets) {
            await walletService.startMonitoring(wallet, socketManager.emitTransaction.bind(socketManager));
        }
        
        // Avvia l'aggiornamento periodico dei dati crypto
        cryptoService.startPeriodicUpdate();
        
        // Avvia il server
        server.listen(PORT, () => {
            logger.info(`Server in esecuzione sulla porta ${PORT}`);
            if (global.lpTracker) {
                global.lpTracker.start();
            }
        });
    } catch (error) {
        logger.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    }
}

startServer();
