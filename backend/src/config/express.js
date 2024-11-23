const express = require('express');
const cors = require('cors');
const { logger } = require('./logger');
const logRoutes = require('../routes/logRoutes');

function setupExpress() {
    const app = express();
    
    // Debug middleware
    app.use((req, res, next) => {
        logger.info(`[Express] ${req.method} ${req.url}`);
        next();
    });

    app.use(cors());
    app.use(express.json());

    // Registra le route per il logging
    app.use('/api/logs', logRoutes);

    return app;
}

module.exports = setupExpress;
