const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../config/logger');

// GET /api/logs
router.get('/', (req, res) => {
    try {
        // Qui potresti implementare la logica per recuperare i log
        // Per ora restituiamo un array vuoto come placeholder
        const logs = [];
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

        // Scrivi anche nel file specifico per le transazioni
        await fs.appendFile(
            path.join(__dirname, '../../../logs', 'transaction-logs.log'),
            `[${new Date(timestamp).toISOString()}] ${logMessage}\n`
        );

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

        // Scrivi anche nel file specifico per LP tracking
        await fs.appendFile(
            path.join(__dirname, '../../../logs', 'lp-tracking-logs.log'),
            `[${new Date(timestamp).toISOString()}] ${logMessage}\n`
        );

        res.status(200).json({ message: 'Log saved successfully' });
    } catch (error) {
        logger.error('Error saving LP tracking log:', error);
        res.status(500).json({ error: 'Failed to save log' });
    }
});

module.exports = router;
