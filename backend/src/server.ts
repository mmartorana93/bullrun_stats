import { createServer } from 'http';
import { setupExpress } from './config/express';
import { logger } from './config/logger';
import SocketManager from './websocket/socketManager';
import { holdingsService } from './services/holdingsService';

const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        // Inizializza Express
        const app = setupExpress();
        
        // Crea il server HTTP
        const httpServer = createServer(app);
        
        // Inizializza Socket.IO
        const socketManager = new SocketManager(httpServer);
        
        // Avvia il server
        httpServer.listen(PORT, () => {
            logger.info(`Server avviato sulla porta ${PORT}`);
            logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        });

        // Gestione graceful shutdown
        const shutdown = async () => {
            logger.info('Ricevuto segnale di shutdown...');
            
            // Cleanup socket connections
            socketManager.cleanup();
            
            // Chiudi il server HTTP
            httpServer.close(() => {
                logger.info('Server HTTP chiuso.');
                process.exit(0);
            });

            // Timeout forzato dopo 10 secondi
            setTimeout(() => {
                logger.error('Shutdown forzato dopo timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    }
}

// Avvia il server
startServer().catch(error => {
    logger.error('Errore fatale durante l\'avvio:', error);
    process.exit(1);
});

// Gestione errori non catturati
process.on('uncaughtException', (error) => {
    logger.error('Errore non catturato:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejection non gestita:', reason);
});
