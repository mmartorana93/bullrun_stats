import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './logger';
import logRoutes from '../routes/logRoutes';
import snipingRoutes from '../routes/snipingRoutes';
import holdingsRoutes from '../routes/holdingsRoutes';
import { requestLogger } from '../middleware/requestLogger';

export function setupExpress(): Express {
    const app = express();
    
    // Middleware di base
    app.use(requestLogger);
    app.use(cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    }));
    app.use(express.json());

    // Health check
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Route API
    app.use('/api/logs', logRoutes);
    app.use('/api/sniping', snipingRoutes);
    app.use('/api/holdings', holdingsRoutes);

    // Gestione errori globale
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Errore non gestito:', err);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' 
                ? err.message 
                : 'Errore interno del server'
        });
    });

    // Gestione 404
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            success: false,
            message: 'Risorsa non trovata'
        });
    });

    return app;
}

export default setupExpress;
