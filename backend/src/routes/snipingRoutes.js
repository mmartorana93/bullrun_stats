const express = require('express');
const snipingService = require('../services/snipingService');
const { logger } = require('../config/logger');

const router = express.Router();

// Route per eseguire uno swap
router.post('/swap', async (req, res) => {
  try {
    logger.info('Richiesta swap ricevuta:', req.body);
    const { inputMint, outputMint, amount, slippageBps } = req.body;
    
    // Validazione dei parametri
    if (!inputMint || !outputMint || amount === undefined || slippageBps === undefined) {
      logger.error('Parametri mancanti nella richiesta di swap:', {
        hasInputMint: !!inputMint,
        hasOutputMint: !!outputMint,
        hasAmount: amount !== undefined,
        hasSlippageBps: slippageBps !== undefined
      });
      
      return res.status(400).json({ 
        success: false, 
        error: 'Parametri mancanti',
        details: {
          inputMint: !inputMint ? 'mancante' : 'presente',
          outputMint: !outputMint ? 'mancante' : 'presente',
          amount: amount === undefined ? 'mancante' : 'presente',
          slippageBps: slippageBps === undefined ? 'mancante' : 'presente'
        }
      });
    }

    // Validazione dei valori
    if (isNaN(amount) || amount <= 0) {
      logger.error('Amount non valido:', amount);
      return res.status(400).json({
        success: false,
        error: 'Amount non valido'
      });
    }

    if (isNaN(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
      logger.error('Slippage non valido:', slippageBps);
      return res.status(400).json({
        success: false,
        error: 'Slippage non valido (deve essere tra 0 e 10000 bps)'
      });
    }

    const result = await snipingService.executeSwap({
      inputMint,
      outputMint,
      amount,
      slippageBps
    });

    if (!result.success) {
      logger.error('Errore durante lo swap:', result.error);
      return res.status(400).json(result);
    }

    logger.info('Swap completato con successo:', result);
    res.json(result);

  } catch (error) {
    logger.error('Errore nella route /swap:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

// Route per ottenere una quotazione
router.get('/quote', async (req, res) => {
  try {
    logger.info('Richiesta quotazione ricevuta:', req.query);
    const { inputMint, outputMint, amount } = req.query;

    // Validazione dei parametri
    if (!inputMint || !outputMint || !amount) {
      logger.error('Parametri mancanti nella richiesta di quotazione:', {
        hasInputMint: !!inputMint,
        hasOutputMint: !!outputMint,
        hasAmount: !!amount
      });
      
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti',
        details: {
          inputMint: !inputMint ? 'mancante' : 'presente',
          outputMint: !outputMint ? 'mancante' : 'presente',
          amount: !amount ? 'mancante' : 'presente'
        }
      });
    }

    // Validazione dell'amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      logger.error('Amount non valido:', amount);
      return res.status(400).json({
        success: false,
        error: 'Amount non valido'
      });
    }

    const result = await snipingService.getQuote(
      inputMint,
      outputMint,
      numAmount
    );

    if (!result.success) {
      logger.error('Errore durante la quotazione:', result.error);
      return res.status(400).json(result);
    }

    logger.info('Quotazione completata con successo:', result);
    res.json(result);

  } catch (error) {
    logger.error('Errore nella route /quote:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

module.exports = router;
