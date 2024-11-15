const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs').promises;
const path = require('path');
const base58 = require('bs58');
const { logger } = require('../config/logger');
const transactionTracker = require('../utils/transactionTracker');

class WalletService {
    constructor() {
        this.monitorThreads = new Map();
        this.monitoredWallets = new Set();
        this.connection = new Connection(
            process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
            {
                commitment: 'confirmed',
                wsEndpoint: process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com/",
                confirmTransactionInitialTimeout: 60000,
            }
        );
    }

    async loadWallets() {
        try {
            const data = await fs.readFile(path.join(__dirname, '../../wallets.json'), 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(path.join(__dirname, '../../wallets.json'), '[]');
                return [];
            }
            throw error;
        }
    }

    async saveWallets() {
        await fs.writeFile(
            path.join(__dirname, '../../wallets.json'),
            JSON.stringify(Array.from(this.monitoredWallets))
        );
    }

    async startMonitoring(walletAddress, emitTransaction) {
        if (!this.monitorThreads.has(walletAddress)) {
            try {
                const publicKey = new PublicKey(walletAddress);
                logger.info(`Iniziando il monitoraggio per il wallet: ${walletAddress}`);

                const subscriptionId = this.connection.onLogs(
                    publicKey,
                    async (logs) => {
                        const signature = logs.signature;
                        
                        if (transactionTracker.isProcessed(signature)) {
                            logger.info(`[WebSocket] Signature ${signature} già processata, skip`);
                            return;
                        }

                        logger.info(`[WebSocket] Ricevuto log per ${walletAddress}:`, {
                            signature,
                            logs: logs.logs,
                            err: logs.err
                        });

                        try {
                            const tx = await this.connection.getTransaction(signature, {
                                maxSupportedTransactionVersion: 0
                            });

                            if (!tx) {
                                logger.warn(`[WebSocket] Nessuna transazione trovata per signature ${signature}`);
                                return;
                            }

                            const preBalance = tx.meta.preBalances[0] / 10**9;
                            const postBalance = tx.meta.postBalances[0] / 10**9;
                            const amount = Math.abs(postBalance - preBalance);
                            const type = postBalance > preBalance ? 'receive' : 'send';

                            await emitTransaction(
                                signature,
                                walletAddress,
                                amount,
                                type
                            );

                            transactionTracker.markAsProcessed(signature);
                        } catch (error) {
                            logger.error(`[WebSocket] Error processing transaction:`, error);
                        }
                    },
                    'confirmed'
                );

                logger.info(`[WebSocket] Subscription ID ottenuto per ${walletAddress}: ${subscriptionId}`);
                this.monitorThreads.set(walletAddress, subscriptionId);
                this.monitoredWallets.add(walletAddress);
                await this.saveWallets();
                logger.info(`Monitoraggio avviato con successo per ${walletAddress}`);
                return true;
            } catch (error) {
                logger.error(`[WebSocket] Error starting monitoring for ${walletAddress}:`, error);
                return false;
            }
        }
        return false;
    }

    async stopMonitoring(walletAddress) {
        if (this.monitorThreads.has(walletAddress)) {
            try {
                const subscriptionId = this.monitorThreads.get(walletAddress);
                logger.info(`[WebSocket] Rimozione subscription ${subscriptionId} per ${walletAddress}`);
                
                await this.connection.removeOnLogsListener(subscriptionId);
                logger.info(`[WebSocket] Listener rimosso con successo per ${walletAddress}`);
                
                this.monitorThreads.delete(walletAddress);
                this.monitoredWallets.delete(walletAddress);
                await this.saveWallets();
                
                logger.info(`Monitoraggio fermato con successo per ${walletAddress}`);
                return true;
            } catch (error) {
                logger.error(`[WebSocket] Errore nell'arresto del monitoraggio per ${walletAddress}:`, error);
                
                // Cleanup forzato in caso di errore
                this.monitorThreads.delete(walletAddress);
                this.monitoredWallets.delete(walletAddress);
                await this.saveWallets();
                
                logger.info(`Cleanup forzato completato per ${walletAddress}`);
                return true; // Ritorniamo true anche in caso di errore per indicare che il wallet è stato rimosso
            }
        }
        return false;
    }

    async getMyWalletInfo(useTestKey = false) {
        const privateKeyEnvVar = useTestKey ? 'SOLANA_PRIVATE_KEY_TEST' : 'SOLANA_PRIVATE_KEY';
        if (!process.env[privateKeyEnvVar]) {
            throw new Error(`${privateKeyEnvVar} non configurata`);
        }

        const keypair = Keypair.fromSecretKey(base58.decode(process.env[privateKeyEnvVar]));
        const walletAddress = keypair.publicKey.toString();
        
        try {
            const balance = await this.connection.getBalance(keypair.publicKey);
            return {
                address: walletAddress,
                balance: balance / 10**9 // Convert lamports to SOL
            };
        } catch (error) {
            logger.error('Errore nel recupero del balance:', error);
            throw error;
        }
    }

    // Nuovo metodo per creare un wallet di test
    async createTestWallet() {
        const newKeypair = Keypair.generate();
        const publicKey = newKeypair.publicKey.toString();
        const privateKey = base58.encode(newKeypair.secretKey);

        try {
            // Richiedi SOL di test dalla devnet
            const airdropSignature = await this.connection.requestAirdrop(
                newKeypair.publicKey,
                2 * 10**9 // 2 SOL in lamports
            );
            
            await this.connection.confirmTransaction(airdropSignature);

            return {
                publicKey,
                privateKey,
                message: 'Wallet di test creato con successo con 2 SOL'
            };
        } catch (error) {
            logger.error('Errore nella creazione del wallet di test:', error);
            throw error;
        }
    }
}

module.exports = new WalletService();
