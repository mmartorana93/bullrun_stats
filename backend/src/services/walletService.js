const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs').promises;
const path = require('path');
const base58 = require('bs58');
const { logger } = require('../config/logger');
const config = require('../config/config');
const transactionTracker = require('../utils/transactionTracker');

// Token di test noti sulla devnet
const TEST_TOKENS = {
    USDC_DEV: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    SRM_DEV: new PublicKey('SNSNkV9zfG5ZKWQs6x4hxvBRV6s8SqMfSGCtECDvdMd'),
    RAY_DEV: new PublicKey('RaYSHhicZ9PwPwBn6AHJpyPxpDwRpf8HM2M4vbVVBzG'),
};

class WalletService {
    constructor(socketManager) {
        this.monitorThreads = new Map();
        this.monitoredWallets = new Set();
        this.connection = new Connection(
            config.SOLANA_RPC_URL,
            {
                commitment: 'confirmed',
                wsEndpoint: config.SOLANA_WS_URL,
                confirmTransactionInitialTimeout: 60000,
            }
        );
        this.socketManager = socketManager;
        this.backupConnections = config.BACKUP_RPC_URLS.map(url => 
            new Connection(url, { commitment: 'confirmed' })
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
        if (this.monitoredWallets.size >= config.MAX_MONITORED_WALLETS) {
            throw new Error(`Limite massimo di wallet monitorati (${config.MAX_MONITORED_WALLETS}) raggiunto`);
        }

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
                            const tx = await this.getTransactionWithRetry(signature);

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
        const privateKeyEnvVar = useTestKey ? 'SOLANA_PRIVATE_KEY_TEST' : 'WALLET_PRIVATE_KEY';
        if (!process.env[privateKeyEnvVar]) {
            throw new Error(`${privateKeyEnvVar} non configurata`);
        }

        logger.info(`Tentativo di decodifica chiave per ${privateKeyEnvVar}`);
        try {
            const keypair = Keypair.fromSecretKey(base58.decode(process.env[privateKeyEnvVar]));
            const walletAddress = keypair.publicKey.toString();
            
            logger.info(`Wallet address decodificato: ${walletAddress}`);
            const balance = await this.connection.getBalance(keypair.publicKey);
            return {
                address: walletAddress,
                balance: balance / 10**9
            };
        } catch (error) {
            logger.error(`Errore nella decodifica della chiave: ${error.message}`);
            throw error;
        }
    }

    async getTransactionWithRetry(signature, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Prova prima con la connessione principale
                const tx = await this.connection.getTransaction(signature, {
                    maxSupportedTransactionVersion: 0
                });
                if (tx) return tx;

                // Se non trova la transazione, prova con i backup RPC
                for (const backupConnection of this.backupConnections) {
                    const tx = await backupConnection.getTransaction(signature, {
                        maxSupportedTransactionVersion: 0
                    });
                    if (tx) return tx;
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Tentativo ${i + 1} fallito per signature ${signature}:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        throw lastError;
    }

    // I metodi di test rimangono ma vengono disabilitati in produzione
    async createTestWallet() {
        if (!config.ENABLE_TEST_FEATURES) {
            throw new Error('Le funzionalità di test sono disabilitate in produzione');
        }

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

    async sendTestTransaction(amount, destinationAddress, useTestKey = true) {
        if (!config.ENABLE_TEST_FEATURES) {
            throw new Error('Le funzionalità di test sono disabilitate in produzione');
        }

        const privateKeyEnvVar = useTestKey ? 'SOLANA_PRIVATE_KEY_TEST' : 'SOLANA_PRIVATE_KEY';
        if (!process.env[privateKeyEnvVar]) {
            throw new Error(`${privateKeyEnvVar} non configurata`);
        }

        try {
            const keypair = Keypair.fromSecretKey(base58.decode(process.env[privateKeyEnvVar]));
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(destinationAddress),
                    lamports: amount * LAMPORTS_PER_SOL
                })
            );

            const signature = await this.connection.sendTransaction(transaction, [keypair]);
            await this.connection.confirmTransaction(signature);
            
            logger.info(`Transazione di test inviata: ${signature}`);
            return signature;
        } catch (error) {
            logger.error('Errore nell\'invio della transazione di test:', error);
            throw error;
        }
    }

    async simulateTokenSwap(useTestKey = true) {
        if (!config.ENABLE_TEST_FEATURES) {
            throw new Error('Le funzionalità di test sono disabilitate in produzione');
        }

        const privateKeyEnvVar = useTestKey ? 'SOLANA_PRIVATE_KEY_TEST' : 'SOLANA_PRIVATE_KEY';
        if (!process.env[privateKeyEnvVar]) {
            throw new Error(`${privateKeyEnvVar} non configurata`);
        }

        try {
            const keypair = Keypair.fromSecretKey(base58.decode(process.env[privateKeyEnvVar]));
            
            // Ottieni o crea un token account per USDC
            logger.info('Creazione token account...');
            const tokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                keypair,
                TEST_TOKENS.USDC_DEV,
                keypair.publicKey
            );

            logger.info(`Token account creato: ${tokenAccount.address.toString()}`);

            // Simula uno swap SOL -> USDC
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: TEST_TOKENS.USDC_DEV,
                    lamports: 0.1 * LAMPORTS_PER_SOL
                })
            );

            // Calcola i balance pre-transazione
            const preBalance = await this.connection.getBalance(keypair.publicKey);
            const preTokenBalance = await this.connection.getTokenAccountBalance(tokenAccount.address);

            logger.info('Invio transazione...');
            const signature = await this.connection.sendTransaction(
                transaction,
                [keypair]
            );

            logger.info('Attesa conferma transazione...');
            await this.connection.confirmTransaction(signature);

            // Calcola i balance post-transazione
            const postBalance = await this.connection.getBalance(keypair.publicKey);
            const postTokenBalance = await this.connection.getTokenAccountBalance(tokenAccount.address);

            // Calcola le variazioni
            const solDelta = (postBalance - preBalance) / LAMPORTS_PER_SOL;
            const tokenDelta = postTokenBalance.value.uiAmount - preTokenBalance.value.uiAmount;
            
            logger.info(`Swap simulato! Signature: ${signature}`);
            
            const transactionDetails = {
                signature,
                tokenAddress: TEST_TOKENS.USDC_DEV.toString(),
                tokenSymbol: 'USDC',
                amountIn: Math.abs(solDelta),
                tokenAmount: Math.abs(tokenDelta),
                type: 'swap',
                timestamp: new Date().toISOString(),
                wallet: keypair.publicKey.toString(),
                success: true,
                token: {
                    address: TEST_TOKENS.USDC_DEV.toString(),
                    symbol: 'USDC',
                    decimals: 6,
                    priceUsd: 1.0,
                    dexScreenerUrl: `https://dexscreener.com/solana/${TEST_TOKENS.USDC_DEV.toString()}`
                },
                preBalances: {
                    sol: preBalance / LAMPORTS_PER_SOL,
                    token: preTokenBalance.value.uiAmount
                },
                postBalances: {
                    sol: postBalance / LAMPORTS_PER_SOL,
                    token: postTokenBalance.value.uiAmount
                }
            };

            logger.info('========= SWAP TRANSACTION DETAILS =========');
            logger.info('Transaction details:', JSON.stringify(transactionDetails, null, 2));
            logger.info('===========================================');

            if (this.socketManager) {
                this.socketManager.emitTransaction(transactionDetails);
            }

            return transactionDetails;

        } catch (error) {
            logger.error('Errore nella simulazione dello swap:', error.message);
            throw new Error(`Errore nella simulazione dello swap: ${error.message}`);
        }
    }
}

module.exports = WalletService;

