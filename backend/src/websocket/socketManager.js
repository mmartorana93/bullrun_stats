const socketIo = require('socket.io');
const { Connection, PublicKey } = require('@solana/web3.js');
const { logger } = require('../config/logger');
const transactionTracker = require('../utils/transactionTracker');

class SocketManager {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            connectTimeout: 10000,
            transports: ['websocket']
        });

        this.connection = new Connection(
            process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
            {
                commitment: 'confirmed',
                wsEndpoint: process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com/",
                confirmTransactionInitialTimeout: 60000,
            }
        );
        
        this.activeSubscriptions = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info('Nuovo client connesso');

            socket.on('startMonitoring', async (wallets) => {
                logger.info(`Client richiede monitoraggio per ${wallets.length} wallets`);
                const cleanup = await this.setupWalletMonitoring(socket, wallets);
                
                socket.on('disconnect', () => {
                    logger.info('Client disconnesso, pulizia subscriptions');
                    cleanup();
                });
            });

            socket.on('getTransactions', () => {
                logger.info('Richiesta transazioni esistenti');
                socket.emit('existingTransactions', []); // Implementare la logica per recuperare le transazioni esistenti
            });

            socket.on('disconnect', () => {
                logger.info('Client disconnesso');
            });
        });
    }

    async setupWalletMonitoring(socket, wallets) {
        const subscriptions = new Map();

        for (const wallet of wallets) {
            try {
                const publicKey = new PublicKey(wallet);
                logger.info(`[WebSocket] Configurazione monitoraggio per ${wallet}`);

                const subscriptionId = this.connection.onLogs(
                    publicKey,
                    async (logs) => {
                        const signature = logs.signature;
                        
                        if (transactionTracker.isProcessed(signature)) {
                            logger.info(`[WebSocket] Signature ${signature} già processata, skip`);
                            return;
                        }

                        logger.info(`[WebSocket] Ricevuto log per ${wallet}:`, {
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

                            const txDetails = await this.analyzeTx(tx, wallet);
                            if (txDetails) {
                                socket.emit('newTransaction', txDetails);
                                transactionTracker.markAsProcessed(signature);
                                logger.info(`[WebSocket] Transazione emessa:`, txDetails);
                            }
                        } catch (error) {
                            logger.error(`[WebSocket] Error processing transaction:`, error);
                        }
                    },
                    'confirmed'
                );

                subscriptions.set(wallet, subscriptionId);
                logger.info(`[WebSocket] Subscription ID ${subscriptionId} creato per ${wallet}`);
            } catch (error) {
                logger.error(`[WebSocket] Errore nel setup del monitoraggio per ${wallet}:`, error);
            }
        }

        // Funzione di cleanup
        return () => {
            subscriptions.forEach((subscriptionId, wallet) => {
                try {
                    this.connection.removeOnLogsListener(subscriptionId);
                    logger.info(`[WebSocket] Rimosso listener per ${wallet}`);
                } catch (error) {
                    logger.error(`[WebSocket] Errore nella rimozione del listener per ${wallet}:`, error);
                }
            });
            subscriptions.clear();
        };
    }

    async analyzeTx(tx, wallet) {
        try {
            const preBalances = tx.meta?.preBalances || [];
            const postBalances = tx.meta?.postBalances || [];
            const preTokenBalances = tx.meta?.preTokenBalances || [];
            const postTokenBalances = tx.meta?.postTokenBalances || [];
            
            // Calcola la variazione del balance in SOL
            const walletIndex = tx.transaction.message.accountKeys.findIndex(
                key => key.toString() === wallet
            );
            
            if (walletIndex === -1) return null;
            
            const solDelta = (postBalances[walletIndex] - preBalances[walletIndex]) / 1e9;
            
            return {
                signature: tx.transaction.signatures[0],
                timestamp: tx.blockTime * 1000, // Converti in millisecondi
                wallet,
                type: solDelta > 0 ? 'RECEIVE' : 'SEND',
                amount: Math.abs(solDelta),
                success: tx.meta?.err === null,
                tokenChanges: this.analyzeTokenChanges(preTokenBalances, postTokenBalances, wallet)
            };
        } catch (error) {
            logger.error('Error analyzing transaction:', error);
            return null;
        }
    }

    analyzeTokenChanges(preTokenBalances, postTokenBalances, wallet) {
        const changes = [];
        
        for (const pre of preTokenBalances) {
            if (pre.owner === wallet) {
                const post = postTokenBalances.find(p => p.mint === pre.mint);
                if (post) {
                    changes.push({
                        tokenAddress: pre.mint,
                        preAmount: pre.uiTokenAmount.amount,
                        postAmount: post.uiTokenAmount.amount,
                        decimals: pre.uiTokenAmount.decimals
                    });
                }
            }
        }
        
        return changes;
    }

    async emitTransaction(transactionDetails) {
        try {
            if (transactionDetails.type === 'swap') {
                const eventData = {
                    signature: transactionDetails.signature,
                    timestamp: transactionDetails.timestamp,
                    wallet: transactionDetails.wallet,
                    type: 'swap',
                    amount_sol: transactionDetails.amountIn,
                    success: true,
                    token: {
                        symbol: transactionDetails.tokenSymbol,
                        address: transactionDetails.tokenAddress,
                        decimals: transactionDetails.token.decimals,
                        priceUsd: transactionDetails.token.priceUsd.toString(),
                        dexScreenerUrl: transactionDetails.token.dexScreenerUrl
                    },
                    tokenAmount: transactionDetails.tokenAmount
                };
                
                logger.info('Emitting swap transaction:', JSON.stringify(eventData, null, 2));
                this.io.emit('newTransaction', eventData);
                return;
            }

            // Per le transazioni normali, usa la logica esistente
            const tx = await this.connection.getTransaction(transactionDetails.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx) {
                logger.error(`Transazione non trovata: ${transactionDetails.signature}`);
                return;
            }

            const transaction = {
                signature: transactionDetails.signature,
                wallet: transactionDetails.wallet,
                timestamp: new Date().toISOString(),
                amount_sol: transactionDetails.amount_sol,
                success: tx.meta?.err === null,
                type: transactionDetails.type
            };

            this.io.emit('newTransaction', transaction);
        } catch (error) {
            logger.error('Errore nell\'emissione della transazione:', error);
        }
    }
}

module.exports = SocketManager;
