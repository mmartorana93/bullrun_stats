const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const { logger } = require('../config/logger');
const { Keypair } = require('@solana/web3.js');

// Funzione per inizializzare le route con il socketManager
function initializeRoutes(socketManager, walletService) {
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

            // Verifica se il wallet è già monitorato
            const currentWallets = await walletService.loadWallets();
            if (currentWallets.includes(wallet)) {
                return res.status(400).json({ error: "Wallet già monitorato" });
            }

            // Avvia il monitoraggio
            const success = await walletService.startMonitoring(
                wallet, 
                socketManager.emitTransaction.bind(socketManager)
            );

            if (success) {
                // Salva il nuovo wallet nel file JSON
                await walletService.saveWallets([...currentWallets, wallet]);
                return res.json({ message: "Wallet aggiunto con successo" });
            }

            res.status(500).json({ error: "Errore nell'avvio del monitoraggio" });
        } catch (error) {
            logger.error('Error adding wallet:', error);
            res.status(500).json({ error: 'Failed to add wallet' });
        }
    });

    // DELETE /api/wallets/:wallet
    router.delete('/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;
            const currentWallets = await walletService.loadWallets();
            
            if (!currentWallets.includes(wallet)) {
                return res.status(404).json({ error: "Wallet non trovato" });
            }

            // Ferma il monitoraggio
            const success = await walletService.stopMonitoring(wallet);
            
            if (success) {
                // Rimuovi il wallet dal file JSON
                const updatedWallets = currentWallets.filter(w => w !== wallet);
                await walletService.saveWallets(updatedWallets);
                return res.json({ message: "Wallet rimosso con successo" });
            }

            res.status(500).json({ error: "Errore nella rimozione del monitoraggio" });
        } catch (error) {
            logger.error('Error removing wallet:', error);
            res.status(500).json({ error: 'Failed to remove wallet' });
        }
    });

    // GET /api/wallets/my-wallet
    router.get('/my-wallet', async (req, res) => {
        try {
            const useTestKey = req.query.useTestKey === 'true';
            logger.info(`Recupero info wallet con useTestKey: ${useTestKey}`);
            const walletInfo = await walletService.getMyWalletInfo(useTestKey);
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

    // POST /api/wallets/send-test-transaction
    router.post('/send-test-transaction', async (req, res) => {
        try {
            const { amount, useTestKey = true } = req.body;
            
            // Crea un wallet random come destinazione
            const destinationWallet = Keypair.generate();
            
            // Invia la transazione usando il wallet di test
            const result = await walletService.sendTestTransaction(
                amount,
                destinationWallet.publicKey.toString(),
                useTestKey
            );

            res.json({
                signature: result,
                message: 'Transazione di test inviata con successo'
            });
        } catch (error) {
            logger.error('Errore nell\'invio della transazione di test:', error);
            res.status(500).json({ 
                error: 'Errore nell\'invio della transazione di test',
                details: error.message 
            });
        }
    });

    // POST /api/wallets/simulate-swap
    router.post('/simulate-swap', async (req, res) => {
        try {
            const { useTestKey = true } = req.body;
            const result = await walletService.simulateTokenSwap(useTestKey);
            
            res.json({
                ...result,
                message: 'Swap simulato con successo'
            });
        } catch (error) {
            logger.error('Errore nella simulazione dello swap:', error);
            res.status(500).json({ 
                error: 'Errore nella simulazione dello swap',
                details: error.message 
            });
        }
    });

    return router;
}

module.exports = initializeRoutes;
