const express = require('express');
const router = express.Router();
const { logger } = require('../config/logger');
const { getCoinbaseRanking } = require('../services/coinbaseService');

router.get('/coinbase-ranking', async (req, res) => {
    try {
        const force = req.query.force === 'true';
        const data = await getCoinbaseRanking(force);
        res.json(data);
    } catch (error) {
        logger.error('Error fetching Coinbase ranking:', error);
        res.status(500).json({ error: 'Failed to fetch ranking' });
    }
});

module.exports = router;
