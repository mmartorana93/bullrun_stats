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
            process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
            {
                commitment: 'confirmed',
                wsEndpoint: process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com/",
                confirmTransactionInitialTimeout: 60000,
            }
        );
        
        this.activeSubscriptions = new Map();
        this.processedTransactions = new Set();
        this.heartbeatIntervals = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info('Nuovo client connesso');

            // Setup heartbeat per questo socket
            const heartbeatInterval = setInterval(() => {
                if (socket.connected) {
                    socket.emit('ping');
                }
            }, 15000);

            this.heartbeatIntervals.set(socket.id, heartbeatInterval);

            socket.on('pong', () => {
                logger.debug(`Heartbeat ricevuto da ${socket.id}`);
            });

            socket.on('startMonitoring', async (wallets) => {
                logger.info(`Client richiede monitoraggio per ${wallets.length} wallets`);
                const cleanup = await this.setupWalletMonitoring(socket, wallets);
                
                socket.on('disconnect', () => {
                    logger.info('Client disconnesso, pulizia subscriptions');
                    cleanup();
                    // Pulizia heartbeat
                    const interval = this.heartbeatIntervals.get(socket.id);
                    if (interval) {
                        clearInterval(interval);
                        this.heartbeatIntervals.delete(socket.id);
                    }
                });
            });

            socket.on('getTransactions', () => {
                logger.info('Richiesta transazioni esistenti');
                socket.emit('existingTransactions', []);
            });

            socket.on('error', (error) => {
                logger.error(`Errore socket per ${socket.id}:`, error);
            });

            socket.on('disconnect', (reason) => {
                logger.info(`Client ${socket.id} disconnesso. Motivo: ${reason}`);
                // Pulizia heartbeat
                const interval = this.heartbeatIntervals.get(socket.id);
                if (interval) {
                    clearInterval(interval);
                    this.heartbeatIntervals.delete(socket.id);
                }
            });
        });

        // Gestione errori a livello di server Socket.IO
        this.io.engine.on('connection_error', (error) => {
            logger.error('Errore connessione Socket.IO:', error);
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
            
            const walletIndex = tx.transaction.message.accountKeys.findIndex(
                key => key.toString() === wallet
            );
            
            if (walletIndex === -1) return null;
            
            const solDelta = (postBalances[walletIndex] - preBalances[walletIndex]) / 1e9;
            
            return {
                signature: tx.transaction.signatures[0],
                timestamp: tx.blockTime * 1000,
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
            if (this.processedTransactions.has(transactionDetails.signature)) {
                logger.info(`Transaction ${transactionDetails.signature} already processed, skipping`);
                return;
            }

            if (transactionDetails.type === 'swap') {
                logger.info('========= PROCESSING SWAP TRANSACTION =========');
                logger.info('Raw transaction details:', JSON.stringify(transactionDetails, null, 2));

                const timestamp = new Date().toISOString();
                const dexScreenerUrl = `https://dexscreener.com/solana/${transactionDetails.tokenAddress}?maker=${transactionDetails.wallet}`;

                const eventData = {
                    signature: transactionDetails.signature,
                    timestamp: timestamp,
                    wallet: transactionDetails.wallet,
                    type: 'swap',
                    amount_sol: transactionDetails.amountIn,
                    success: true,
                    token: {
                        symbol: transactionDetails.tokenSymbol,
                        address: transactionDetails.tokenAddress,
                        decimals: transactionDetails.token.decimals,
                        priceUsd: transactionDetails.token.priceUsd.toString(),
                        dexScreenerUrl: dexScreenerUrl
                    },
                    tokenAmount: transactionDetails.tokenAmount,
                    links: {
                        dexScreener: dexScreenerUrl,
                        photon: `https://photon-sol.tinyastro.io/en/lp/${transactionDetails.tokenAddress}`,
                        rugcheck: `https://rugcheck.xyz/tokens/${transactionDetails.tokenAddress}`
                    },
                    preBalances: transactionDetails.preBalances,
                    postBalances: transactionDetails.postBalances
                };

                logger.info('Prepared event data:', JSON.stringify(eventData, null, 2));
                logger.info('Token details:', JSON.stringify(eventData.token, null, 2));
                logger.info('Links:', JSON.stringify(eventData.links, null, 2));
                logger.info('Balance changes:', JSON.stringify({
                    pre: eventData.preBalances,
                    post: eventData.postBalances
                }, null, 2));

                logger.info('Emitting newTransaction event...');
                this.io.emit('newTransaction', eventData);
                this.processedTransactions.add(transactionDetails.signature);
                
                logger.info(`Successfully emitted swap transaction for token ${eventData.token.symbol}`);
                logger.info('==========================================');
                return;
            }

            try {
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
                this.processedTransactions.add(transactionDetails.signature);
            } catch (error) {
                logger.error(`Errore nel recupero della transazione: ${error.message}`);
            }

        } catch (error) {
            logger.error('Errore nell\'emissione della transazione:', error);
            logger.error('Stack trace:', error.stack);
            logger.error('Transaction details:', JSON.stringify(transactionDetails, null, 2));
        }
    }
}

module.exports = SocketManager;
