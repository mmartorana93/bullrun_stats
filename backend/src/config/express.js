const express = require('express');
const cors = require('cors');
const { logger } = require('./logger');
const { requestLogger } = require('../middleware/requestLogger');

function setupExpress() {
    const app = express();

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
    app.use(async (err, req, res, next) => {
        const logMessage = `Errore non gestito: ${err.message}`;
        logger.error(logMessage);
        res.status(500).json({ 
            error: 'Errore interno del server',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });

    return app;
}

module.exports = setupExpress;
