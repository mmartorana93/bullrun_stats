import { Router } from 'express';
import { holdingsService } from '../services/holdingsService';
import { logger } from '../config/logger';

const router = Router();

// Ottieni tutti gli holdings
router.get('/', async (req, res) => {
    try {
        const holdings = await holdingsService.getHoldings();
        res.json({
            success: true,
            data: holdings
        });
    } catch (error) {
        logger.error('Errore nel recupero degli holdings:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Forza un aggiornamento dei prezzi
router.post('/refresh', async (req, res) => {
    try {
        await holdingsService.refreshPrices();
        const holdings = await holdingsService.getHoldings();
        res.json({
            success: true,
            data: holdings,
            message: 'Prezzi aggiornati con successo'
        });
    } catch (error) {
        logger.error('Errore nell\'aggiornamento dei prezzi:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Filtra gli holdings per wallet
router.get('/wallet/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const holdings = await holdingsService.getHoldings();
        const filteredHoldings = holdings.filter(holding => 
            holding.wallets.some(w => w.address === address)
        );
        
        res.json({
            success: true,
            data: filteredHoldings
        });
    } catch (error) {
        logger.error('Errore nel recupero degli holdings per wallet:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Ottieni tutti i token di un wallet
router.get('/wallet/:address/tokens', async (req, res) => {
    try {
        const { address } = req.params;
        const walletTokens = await holdingsService.getWalletTokens(address);
        
        res.json({
            success: true,
            data: walletTokens
        });
    } catch (error) {
        logger.error('Errore nel recupero dei token del wallet:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Filtra gli holdings per fonte (trading/sniping)
router.get('/source/:source', async (req, res) => {
    try {
        const { source } = req.params;
        if (source !== 'trading' && source !== 'sniping') {
            return res.status(400).json({
                success: false,
                message: 'Fonte non valida. Usa "trading" o "sniping"'
            });
        }

        const holdings = await holdingsService.getHoldings();
        const filteredHoldings = holdings.filter(h => h.source === source);
        
        res.json({
            success: true,
            data: filteredHoldings
        });
    } catch (error) {
        logger.error('Errore nel recupero degli holdings per fonte:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

// Ottieni statistiche aggregate
router.get('/stats', async (req, res) => {
    try {
        const holdings = await holdingsService.getHoldings();
        
        const stats = {
            totalInvested: holdings.reduce((acc, h) => acc + h.invested, 0),
            totalRemaining: holdings.reduce((acc, h) => acc + h.remaining, 0),
            totalSold: holdings.reduce((acc, h) => acc + h.sold, 0),
            totalPnL: holdings.reduce((acc, h) => acc + (typeof h.pnl === 'number' ? h.pnl : 0), 0),
            holdingsCount: holdings.length,
            bySource: {
                trading: holdings.filter(h => h.source === 'trading').length,
                sniping: holdings.filter(h => h.source === 'sniping').length
            }
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Errore nel calcolo delle statistiche:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Errore interno del server'
        });
    }
});

export default router;
