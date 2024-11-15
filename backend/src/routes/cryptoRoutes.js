const express = require('express');
const router = express.Router();
const cryptoService = require('../services/cryptoService');
const { logger } = require('../config/logger');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// GET /api/crypto/all
router.get('/all', async (req, res) => {
    try {
        const data = await cryptoService.updateAllData();
        if (!data) {
            return res.status(500).json({ error: 'No data available' });
        }
        res.json(data);
    } catch (error) {
        logger.error('Error serving crypto data:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/bitcoin-dominance
router.get('/bitcoin-dominance', async (req, res) => {
    try {
        const data = await cryptoService.getBitcoinDominance();
        logger.info('Sending BTC dominance data:', data);
        res.json(data);
    } catch (error) {
        logger.error('Error fetching Bitcoin dominance:', error);
        res.status(500).json({ error: 'Failed to fetch Bitcoin dominance' });
    }
});

// GET /api/crypto/coinbase-ranking
router.get('/coinbase-ranking', async (req, res) => {
    try {
        const force = req.query.force === 'true';
        const python = spawn('python3', ['coinbaseScraper.py', force ? '--force' : '']);
        
        let data = '';
        
        python.stdout.on('data', (chunk) => {
            data += chunk;
        });

        python.stderr.on('data', (data) => {
            logger.error(`Error from Python script: ${data}`);
        });

        python.on('close', async (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Failed to fetch ranking' });
            }

            try {
                const storedData = await fs.readFile(
                    path.join(__dirname, '../../coinbase_ranking.json'), 
                    'utf8'
                );
                const parsedData = JSON.parse(storedData);
                res.json(parsedData);
            } catch (error) {
                logger.error('Error reading ranking file:', error);
                res.status(500).json({ error: 'Failed to read ranking data' });
            }
        });
    } catch (error) {
        logger.error('Error in coinbase ranking endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/crypto/solana-price
router.get('/solana-price', (req, res) => {
    try {
        // Assumiamo che il prezzo di Solana sia disponibile attraverso lpTracker
        // Questo dovrebbe essere gestito in modo più appropriato
        const price = global.lpTracker?.solPrice || 0;
        logger.info(`Sending Solana price: $${price}`);
        res.json({ price });
    } catch (error) {
        logger.error('Error getting Solana price:', error);
        res.status(500).json({ error: 'Failed to get Solana price' });
    }
});

module.exports = router;
