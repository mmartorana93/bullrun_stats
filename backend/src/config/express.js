const express = require('express');
const cors = require('cors');
const { logger } = require('./logger');

function setupExpress() {
    const app = express();
    
    // Debug middleware
    app.use((req, res, next) => {
        logger.info(`[Express] ${req.method} ${req.url}`);
        next();
    });

    app.use(cors());
    app.use(express.json());

    return app;
}

module.exports = setupExpress;
