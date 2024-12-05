require('dotenv').config();
const http = require('http');
const { logger, ensureLogDirectory } = require('./src/config/logger');
const setupExpress = require('./src/config/express');
const SocketManager = require('./src/websocket/socketManager');
const initializeWalletRoutes = require('./src/routes/walletRoutes');
const logRoutes = require('./src/routes/logRoutes');
const WalletService = require('./src/services/walletService');
const LPTracker = require('./lpTracker');
const config = require('./src/config/config');
const featureRoutes = require('./src/routes/featureRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const snipingRoutes = require('./src/routes/snipingRoutes');
const holdingsRoutes = require('./src/routes/holdingsRoutes'); // Aggiunto import
const cors = require('cors');

try {
    // Inizializza l'app Express
    const app = setupExpress();

    // Configura CORS
    app.use(cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }));

    // Crea il server HTTP
    const server = http.createServer(app);

    // Prima crea il WalletService senza socketManager
    const walletService = new WalletService();

    // Poi crea il SocketManager con il walletService
    const socketManager = new SocketManager(server, walletService);

    // Infine collega il socketManager al walletService
    walletService.setSocketManager(socketManager);

    // Aggiungi middleware di logging per tutte le richieste
    app.use((req, res, next) => {
        logger.info(`[${req.method}] ${req.path}`);
        next();
    });

    // Test route per verificare che Express funzioni
    app.get('/test', (req, res) => {
        res.json({ message: 'Test route ok' });
    });

    // Modifica l'inizializzazione del LP Tracker
    if (config.ENABLE_LP_TRACKING) {
        global.lpTracker = new LPTracker(socketManager.io);
    } else {
        logger.info('LP Tracking feature disabilitata');
    }

    // Assicurati che la directory dei log esista
    ensureLogDirectory();

    // Configura le routes
    app.use('/health', healthRoutes);
    app.use('/api/wallets', initializeWalletRoutes(socketManager, walletService));
    app.use('/api/sniper', snipingRoutes);
    app.use('/api/holdings', holdingsRoutes); // Aggiunta registrazione rotte holdings

    // Aggiungi handler per route non trovate
    app.use((req, res) => {
        logger.warn(`Route non trovata: ${req.method} ${req.path}`);
        res.status(404).json({ error: 'Route non trovata' });
    });

    // Avvia il server
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
        logger.info(`Server in ascolto sulla porta ${PORT}`);
        // Log tutte le route registrate
        app._router.stack.forEach(r => {
            if (r.route && r.route.path) {
                logger.info(`Route registrata: ${Object.keys(r.route.methods)} ${r.route.path}`);
            }
        });
    }).on('error', (error) => {
        logger.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    });

} catch (error) {
    logger.error('Errore durante l\'inizializzazione del server:', error);
    process.exit(1);
}

// Gestione degli errori non catturati
process.on('uncaughtException', (error) => {
    logger.error('Errore non catturato:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejection non gestita:', reason);
    process.exit(1);
});
