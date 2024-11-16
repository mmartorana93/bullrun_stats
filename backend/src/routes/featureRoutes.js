const express = require('express');
const router = express.Router();
const config = require('../config/config');
const { logger } = require('../config/logger');

router.get('/lp-tracking', (req, res) => {
    try {
        res.json({ 
            enabled: config.ENABLE_LP_TRACKING 
        });
    } catch (error) {
        logger.error('Errore nel recupero dello stato della feature:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

module.exports = router; 