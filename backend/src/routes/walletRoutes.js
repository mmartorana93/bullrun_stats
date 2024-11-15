const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const { logger } = require('../config/logger');

// Funzione per inizializzare le route con il socketManager
function initializeRoutes(socketManager) {
    // GET /api/wallets
    router.get('/', async (req, res) => {
        try {
            const wallets = await walletService.loadWallets();
            res.json(wallets);
        } catch (error) {
            logger.error('Error getting wallets:', error);
            res.status(500).json({ error: 'Failed to get wallets' });
        }
    });

    // POST /api/wallets
    router.post('/', async (req, res) => {
        try {
            const { wallet } = req.body;
            
            if (!wallet) {
                return res.status(400).json({ error: "Wallet address required" });
            }

            if (await walletService.startMonitoring(wallet, socketManager.emitTransaction.bind(socketManager))) {
                return res.json({ message: "Wallet added successfully" });
            }

            res.status(400).json({ error: "Wallet already monitored" });
        } catch (error) {
            logger.error('Error adding wallet:', error);
            res.status(500).json({ error: 'Failed to add wallet' });
        }
    });

    // DELETE /api/wallets/:wallet
    router.delete('/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;

            if (await walletService.stopMonitoring(wallet)) {
                return res.json({ message: "Wallet removed successfully" });
            }

            res.status(404).json({ error: "Wallet not found" });
        } catch (error) {
            logger.error('Error removing wallet:', error);
            res.status(500).json({ error: 'Failed to remove wallet' });
        }
    });

    // GET /api/wallets/my-wallet
    router.get('/my-wallet', async (req, res) => {
        try {
            const walletInfo = await walletService.getMyWalletInfo();
            res.json(walletInfo);
        } catch (error) {
            logger.error('Errore nel recupero info wallet:', error);
            res.status(500).json({ 
                error: 'Errore nel recupero info wallet',
                details: error.message 
            });
        }
    });

    // POST /api/wallets/create-test
    router.post('/create-test', async (req, res) => {
        try {
            const testWallet = await walletService.createTestWallet();
            
            // Avvia automaticamente il monitoraggio del wallet di test
            await walletService.startMonitoring(
                testWallet.publicKey,
                socketManager.emitTransaction.bind(socketManager)
            );

            res.json({
                ...testWallet,
                message: 'Wallet di test creato e monitoraggio avviato',
                note: 'Conserva la privateKey in modo sicuro per poter effettuare transazioni di test'
            });
        } catch (error) {
            logger.error('Errore nella creazione del wallet di test:', error);
            res.status(500).json({ 
                error: 'Errore nella creazione del wallet di test',
                details: error.message 
            });
        }
    });

    return router;
}

module.exports = initializeRoutes;
