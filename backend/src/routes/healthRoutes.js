const express = require('express');
const router = express.Router();
const { logger } = require('../config/logger');

router.get('/', (req, res) => {
    try {
        res.status(200).json({ status: 'healthy' });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

module.exports = router; 