const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { logger, writeLogToFile } = require('../config/logger');

// GET /api/logs
router.get('/', async (req, res) => {
    try {
        const logsDir = path.join(__dirname, '../../logs');
        const logFiles = await fs.readdir(logsDir);
        const logs = [];
        
        for (const file of logFiles) {
            if (file.endsWith('.log')) {
                const content = await fs.readFile(path.join(logsDir, file), 'utf8');
                logs.push({
                    filename: file,
                    content: content.split('\n').filter(Boolean)
                });
            }
        }
        
        res.json(logs);
    } catch (error) {
        logger.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// POST /api/logs/transaction
router.post('/transaction', async (req, res) => {
    try {
        const {
            timestamp,
            wallet,
            type,
            amount_sol,
            success,
            signature
        } = req.body;

        const logMessage = `TRANSACTION - Wallet: ${wallet} - Type: ${type} - Amount: ${amount_sol} SOL - Status: ${success ? 'SUCCESS' : 'FAILED'} - Signature: ${signature}`;
        
        // Usa il logger Winston
        logger.info(logMessage);
        
        // Scrivi nel file specifico per le transazioni
        await writeLogToFile('transaction-logs.log', logMessage);

        res.status(200).json({ message: 'Log saved successfully' });
    } catch (error) {
        logger.error('Error saving transaction log:', error);
        res.status(500).json({ error: 'Failed to save log' });
    }
});

// POST /api/logs/lptracking
router.post('/lptracking', async (req, res) => {
    try {
        const {
            timestamp,
            tokenAccount,
            tokenAmount,
            solanaAmount,
            usdValue,
            txId,
            riskAnalysis
        } = req.body;

        const riskStatus = riskAnalysis?.isSafeToBuy ? 'SAFE' : 'RISKY';
        const logMessage = `LP_POOL - Token: ${tokenAccount} - Amount: ${tokenAmount} tokens / ${solanaAmount} SOL - Value: $${usdValue} - Risk: ${riskStatus} - TxID: ${txId}`;
        
        // Usa il logger Winston
        logger.info(logMessage);
        
        // Scrivi nel file specifico per LP tracking
        await writeLogToFile('lp-tracking-logs.log', logMessage);

        res.status(200).json({ message: 'Log saved successfully' });
    } catch (error) {
        logger.error('Error saving LP tracking log:', error);
        res.status(500).json({ error: 'Failed to save log' });
    }
});

module.exports = router;
