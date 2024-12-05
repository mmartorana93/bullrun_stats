const express = require('express');
const holdingsService = require('../services/holdingsService');
const { logger } = require('../config/logger');

const router = express.Router();

// Ottieni i token del wallet principale
router.get('/my-tokens', async (req, res) => {
    try {
        logger.info('Richiesta recupero token ricevuta');
        const result = await holdingsService.getMyTokens();

        if (!result.success) {
            logger.error('Errore nel recupero dei token:', result.error);
            return res.status(400).json(result);
        }

        logger.info('Token recuperati con successo');
        res.json(result);
    } catch (error) {
        logger.error('Errore nella route /my-tokens:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Forza un aggiornamento dei prezzi
router.post('/refresh-prices', async (req, res) => {
    try {
        logger.info('Richiesta refresh prezzi ricevuta');
        const refreshResult = await holdingsService.refreshPrices();

        if (!refreshResult.success) {
            logger.error('Errore nel refresh dei prezzi:', refreshResult.error);
            return res.status(400).json(refreshResult);
        }

        // Dopo il refresh, recupera i token aggiornati
        const tokensResult = await holdingsService.getMyTokens();
        
        if (!tokensResult.success) {
            logger.error('Errore nel recupero dei token dopo il refresh:', tokensResult.error);
            return res.status(400).json(tokensResult);
        }

        logger.info('Prezzi aggiornati con successo');
        res.json({
            success: true,
            data: tokensResult.data,
            message: 'Prezzi aggiornati con successo'
        });
    } catch (error) {
        logger.error('Errore nella route /refresh-prices:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

module.exports = router;
