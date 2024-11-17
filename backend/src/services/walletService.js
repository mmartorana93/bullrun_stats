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
    USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    SRM: new PublicKey('SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt'),
    RAY: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
};

class WalletService {
    constructor() {
        this.monitorThreads = new Map();
        this.monitoredWallets = new Set();
        this.pausedWallets = new Set();
        this.connection = new Connection(
            config.SOLANA_RPC_URL,
            {
                commitment: 'confirmed',
                wsEndpoint: config.SOLANA_WS_URL,
                confirmTransactionInitialTimeout: 60000,
            }
        );
        this.backupConnections = config.BACKUP_RPC_URLS.map(url => 
            new Connection(url, { commitment: 'confirmed' })
        );
        
        // Inizializza i wallet usando le chiavi private dal .env
        try {
            const testPrivateKey = process.env.SOLANA_PRIVATE_KEY_TEST;
            const mainPrivateKey = process.env.SOLANA_PRIVATE_KEY;

            if (testPrivateKey) {
                this.testWallet = Keypair.fromSecretKey(base58.decode(testPrivateKey));
                this.testWalletAddress = this.testWallet.publicKey.toString();
            }

            if (mainPrivateKey) {
                this.mainWallet = Keypair.fromSecretKey(base58.decode(mainPrivateKey));
                this.mainWalletAddress = this.mainWallet.publicKey.toString();
            }
        } catch (error) {
            logger.error('Errore nell\'inizializzazione dei wallet:', error);
        }

        // Carica i wallet salvati all'avvio e inizia il monitoraggio
        this.initializeMonitoring();
        this.setupHealthCheck();
    }

    setSocketManager(socketManager) {
        this.socketManager = socketManager;
    }

    setupHealthCheck() {
        setInterval(async () => {
            for (const [wallet, subscriptionId] of this.monitorThreads) {
                try {
                    // Salta il controllo per i wallet in pausa
                    if (this.pausedWallets.has(wallet)) continue;

                    logger.debug(`Active subscription for ${wallet}: ${subscriptionId}`);
                    // Verifica che la subscription sia ancora attiva
                    const isActive = await this.connection.getSlot();
                    if (!isActive) {
                        logger.warn(`Subscription ${subscriptionId} per ${wallet} non attiva, riconnessione...`);
                        await this.restartMonitoring(wallet);
                    }
                } catch (error) {
                    logger.error(`Health check error for ${wallet}:`, error);
                    await this.restartMonitoring(wallet);
                }
            }
        }, 30000); // Check ogni 30s
    }

    async restartMonitoring(wallet) {
        // Non riavviare il monitoraggio se il wallet è in pausa
        if (this.pausedWallets.has(wallet)) {
            logger.info(`Skipping restart for paused wallet: ${wallet}`);
            return;
        }
        await this.stopMonitoring(wallet);
        await this.startMonitoring(wallet, this.socketManager.emitTransaction.bind(this.socketManager));
    }

    async initializeMonitoring() {
        try {
            const savedWallets = await this.loadWallets();
            for (const wallet of savedWallets) {
                // Non avviare il monitoraggio per i wallet in pausa
                if (!this.pausedWallets.has(wallet)) {
                    await this.startMonitoring(wallet, this.socketManager.emitTransaction.bind(this.socketManager));
                }
            }
            logger.info(`Inizializzato monitoraggio per ${savedWallets.length} wallet`);
        } catch (error) {
            logger.error('Errore nell\'inizializzazione del monitoraggio:', error);
        }
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

    async saveWallets(wallets) {
        try {
            await fs.writeFile(
                path.join(__dirname, '../../wallets.json'),
                JSON.stringify(wallets)
            );
            this.monitoredWallets = new Set(wallets);
        } catch (error) {
            logger.error('Errore nel salvataggio dei wallet:', error);
            throw error;
        }
    }

    async pauseWallet(walletAddress) {
        try {
            logger.info(`Pausing monitoring for wallet: ${walletAddress}`);
            
            // Aggiungi il wallet alla lista dei wallet in pausa
            this.pausedWallets.add(walletAddress);
            
            // Ferma il monitoraggio attivo
            if (this.monitorThreads.has(walletAddress)) {
                await this.stopMonitoring(walletAddress);
            }
            
            logger.info(`Successfully paused monitoring for ${walletAddress}`);
            return true;
        } catch (error) {
            logger.error(`Error pausing monitoring for ${walletAddress}:`, error);
            return false;
        }
    }

    async resumeWallet(walletAddress) {
        try {
            logger.info(`Resuming monitoring for wallet: ${walletAddress}`);
            
            // Rimuovi il wallet dalla lista dei wallet in pausa
            this.pausedWallets.delete(walletAddress);
            
            // Riavvia il monitoraggio
            await this.startMonitoring(walletAddress, this.socketManager.emitTransaction.bind(this.socketManager));
            
            logger.info(`Successfully resumed monitoring for ${walletAddress}`);
            return true;
        } catch (error) {
            logger.error(`Error resuming monitoring for ${walletAddress}:`, error);
            return false;
        }
    }

    async startMonitoring(walletAddress, emitTransaction) {
        try {
            // Non avviare il monitoraggio se il wallet è in pausa
            if (this.pausedWallets.has(walletAddress)) {
                logger.info(`Skipping monitoring for paused wallet: ${walletAddress}`);
                return true;
            }

            if (!this.connection) {
                logger.error('Connection not initialized');
                return false;
            }

            logger.info(`Starting monitoring for wallet: ${walletAddress}`);

            if (this.monitorThreads.has(walletAddress)) {
                logger.warn(`Wallet ${walletAddress} already being monitored`);
                return true;
            }

            // Verifica che l'indirizzo sia valido
            const pubKey = new PublicKey(walletAddress);
            
            // Sottoscrizione ai log delle transazioni
            const subscriptionId = this.connection.onLogs(
                pubKey,
                async (logs) => {
                    try {
                        // Non processare le transazioni se il wallet è in pausa
                        if (this.pausedWallets.has(walletAddress)) {
                            return;
                        }

                        if (!logs.err) {
                            const signature = logs.signature;
                            
                            // Evita duplicati
                            if (transactionTracker.isProcessed(signature)) {
                                return;
                            }
                            transactionTracker.markAsProcessed(signature);

                            logger.info(`New transaction detected for ${walletAddress}: ${signature}`);

                            // Recupera i dettagli della transazione
                            const transaction = await this.getTransactionWithRetry(signature);
                            if (!transaction) {
                                logger.warn(`Transaction ${signature} not found`);
                                return;
                            }

                            // Emetti la transazione
                            if (emitTransaction) {
                                emitTransaction({
                                    signature,
                                    wallet: walletAddress,
                                    type: 'transaction',
                                    amount_sol: transaction.meta?.postBalances[0] 
                                        ? (transaction.meta.preBalances[0] - transaction.meta.postBalances[0]) / LAMPORTS_PER_SOL 
                                        : 0,
                                    success: !logs.err,
                                    timestamp: Date.now()
                                });
                            }
                        }
                    } catch (error) {
                        logger.error(`Error processing transaction for ${walletAddress}:`, error);
                    }
                },
                'confirmed'
            );

            logger.info(`[WebSocket] Subscription ID obtained for ${walletAddress}: ${subscriptionId}`);
            this.monitorThreads.set(walletAddress, subscriptionId);
            this.monitoredWallets.add(walletAddress);
            
            await this.saveWallets(Array.from(this.monitoredWallets));
            
            logger.info(`Monitoring successfully started for ${walletAddress}`);
            return true;
        } catch (error) {
            logger.error(`[WebSocket] Error starting monitoring for ${walletAddress}:`, error);
            return false;
        }
    }

    async stopMonitoring(walletAddress) {
        if (this.monitorThreads.has(walletAddress)) {
            try {
                const subscriptionId = this.monitorThreads.get(walletAddress);
                logger.info(`[WebSocket] Rimozione subscription ${subscriptionId} per ${walletAddress}`);
                
                await this.connection.removeOnLogsListener(subscriptionId);
                logger.info(`[WebSocket] Listener rimosso con successo per ${walletAddress}`);
                
                this.monitorThreads.delete(walletAddress);
                
                // Non rimuovere dalla lista dei wallet monitorati se è in pausa
                if (!this.pausedWallets.has(walletAddress)) {
                    this.monitoredWallets.delete(walletAddress);
                    await this.saveWallets(Array.from(this.monitoredWallets));
                }
                
                logger.info(`Monitoraggio fermato con successo per ${walletAddress}`);
                return true;
            } catch (error) {
                logger.error(`[WebSocket] Errore nell'arresto del monitoraggio per ${walletAddress}:`, error);
                
                // Cleanup forzato in caso di errore
                this.monitorThreads.delete(walletAddress);
                if (!this.pausedWallets.has(walletAddress)) {
                    this.monitoredWallets.delete(walletAddress);
                    await this.saveWallets(Array.from(this.monitoredWallets));
                }
                
                logger.info(`Cleanup forzato completato per ${walletAddress}`);
                return true;
            }
        }
        return false;
    }

    async getMyWalletInfo() {
        try {
            // Usa sempre il mainWallet invece di controllare se è devnet
            const walletAddress = this.mainWalletAddress;

            if (!walletAddress) {
                throw new Error('MAIN_WALLET non inizializzato correttamente');
            }

            const publicKey = new PublicKey(walletAddress);
            const balance = await this.connection.getBalance(publicKey);

            return {
                address: walletAddress,
                balance: balance / 1e9,
                isTestWallet: false
            };
        } catch (error) {
            logger.error('Errore nel recupero info wallet:', error);
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
                TEST_TOKENS.USDC,
                keypair.publicKey
            );

            logger.info(`Token account creato: ${tokenAccount.address.toString()}`);

            // Simula uno swap SOL -> USDC
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: TEST_TOKENS.USDC,
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
                tokenAddress: TEST_TOKENS.USDC.toString(),
                tokenSymbol: 'USDC',
                amountIn: Math.abs(solDelta),
                tokenAmount: Math.abs(tokenDelta),
                type: 'swap',
                timestamp: new Date().toISOString(),
                wallet: keypair.publicKey.toString(),
                success: true,
                token: {
                    address: TEST_TOKENS.USDC.toString(),
                    symbol: 'USDC',
                    decimals: 6,
                    priceUsd: 1.0,
                    dexScreenerUrl: `https://dexscreener.com/solana/${TEST_TOKENS.USDC.toString()}`
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

    async startMonitoringWithRetry(wallet, maxAttempts = 5) {
        // Non tentare il monitoraggio se il wallet è in pausa
        if (this.pausedWallets.has(wallet)) {
            logger.info(`Skipping monitoring for paused wallet: ${wallet}`);
            return true;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const success = await this.startMonitoring(wallet);
                if (success) return true;
            } catch (error) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
                logger.warn(`Tentativo ${attempt} fallito per ${wallet}, retry in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false;
    }
}

module.exports = WalletService;
