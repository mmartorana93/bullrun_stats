import { Router } from 'express';
import { snipingService } from '../services/snipingService';

const router = Router();

// Avvia un nuovo snipe
router.post('/start', async (req, res) => {
  try {
    const {
      tokenAddress,
      tokenName,
      walletId,
      buyAmount,
      takeProfit,
      stopLoss,
      slippageBps,
      launchDate
    } = req.body;

    const result = await snipingService.startSnipe({
      tokenAddress,
      tokenName,
      walletId,
      buyAmount,
      takeProfit,
      stopLoss,
      slippageBps,
      launchDate: launchDate ? new Date(launchDate) : undefined
    });

    res.json(result);
  } catch (error) {
    console.error('Errore nell\'avvio dello snipe:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

// Ferma uno snipe attivo
router.post('/stop', async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    const stopped = snipingService.stopSnipe(tokenAddress);
    
    res.json({
      success: true,
      stopped,
      message: stopped ? 'Snipe fermato con successo' : 'Nessuno snipe attivo trovato'
    });
  } catch (error) {
    console.error('Errore nel fermare lo snipe:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

// Ottieni lo stato di uno snipe specifico
router.get('/status/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const isActive = snipingService.isSnipeActive(tokenAddress);
    
    res.json({
      success: true,
      active: isActive,
      message: isActive ? 'Snipe attivo' : 'Nessuno snipe attivo'
    });
  } catch (error) {
    console.error('Errore nel recupero dello stato:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

// Ottieni tutti gli snipe attivi
router.get('/active', async (req, res) => {
  try {
    const activeSnipes = snipingService.getActiveSnipes();
    
    res.json({
      success: true,
      activeSnipes,
      count: activeSnipes.length
    });
  } catch (error) {
    console.error('Errore nel recupero degli snipe attivi:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Errore interno del server'
    });
  }
});

export default router;
