require('dotenv').config();
const http = require('http');
const { logger, ensureLogDirectory } = require('./src/config/logger');
const setupExpress = require('./src/config/express');
const SocketManager = require('./src/websocket/socketManager');
const initializeWalletRoutes = require('./src/routes/walletRoutes');
const cryptoRoutes = require('./src/routes/cryptoRoutes');
const logRoutes = require('./src/routes/logRoutes');
const cryptoService = require('./src/services/cryptoService');
const WalletService = require('./src/services/walletService');
const LPTracker = require('./lpTracker');
const config = require('./src/config/config');
const featureRoutes = require('./src/routes/featureRoutes');

// Inizializza l'app Express
const app = setupExpress();

// Crea il server HTTP
const server = http.createServer(app);

// Inizializza Socket.IO
const socketManager = new SocketManager(server);

// Inizializza il WalletService con il socketManager
const walletService = new WalletService(socketManager);

// Modifica l'inizializzazione del LP Tracker
if (config.ENABLE_LP_TRACKING) {
    global.lpTracker = new LPTracker(socketManager.io);
} else {
    logger.info('LP Tracking feature disabilitata');
}

// Assicurati che la directory dei log esista
ensureLogDirectory();

// Configura le routes
app.use('/api/wallets', initializeWalletRoutes(socketManager, walletService));
app.use('/api/crypto', cryptoRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/features', featureRoutes);

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

// Modifica la funzione gracefulShutdown
async function gracefulShutdown(signal) {
    logger.info(`${signal} ricevuto. Avvio shutdown graceful...`);
    
    // Aumentiamo il timeout a 10 secondi
    const shutdownTimeout = setTimeout(() => {
        logger.error('Shutdown forzato dopo timeout');
        process.exit(1);
    }, 10000);

    try {
        // Chiudi prima le connessioni WebSocket
        if (socketManager && socketManager.io) {
            logger.info('Chiusura connessioni Socket.IO...');
            await new Promise(resolve => socketManager.io.close(resolve));
        }

        // Ferma il LP Tracker solo se abilitato
        if (config.ENABLE_LP_TRACKING && global.lpTracker) {
            logger.info('Arresto LP Tracker...');
            global.lpTracker.stop();
        }

        // Chiudi il server HTTP solo se stiamo effettivamente facendo shutdown
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            await new Promise((resolve, reject) => {
                server.close(err => {
                    if (err) {
                        logger.error('Errore nella chiusura del server:', err);
                        reject(err);
                    } else {
                        logger.info('Server HTTP chiuso con successo');
                        resolve();
                    }
                });
            });
        }

        clearTimeout(shutdownTimeout);
        
        // Esci solo se è una richiesta di shutdown effettiva
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            logger.info('Shutdown completato con successo');
            process.exit(0);
        }
    } catch (error) {
        logger.error('Errore durante lo shutdown:', error);
        clearTimeout(shutdownTimeout);
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            process.exit(1);
        }
    }
}

// Gestione dei segnali di shutdown - rimuovi il doppio handler SIGINT
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestione errori non catturati
process.on('uncaughtException', (error) => {
    logger.error('Eccezione non gestita:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Rejection non gestita:', reason);
    // Non facciamo shutdown per unhandledRejection, solo log
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
            if (config.ENABLE_LP_TRACKING && global.lpTracker) {
                global.lpTracker.start();
            }
        });
    } catch (error) {
        logger.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    }
}

startServer();
