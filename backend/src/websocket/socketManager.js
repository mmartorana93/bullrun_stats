const { Server } = require('socket.io');
const { Connection, PublicKey } = require('@solana/web3.js');
const { logger } = require('../config/logger');
const transactionTracker = require('../utils/transactionTracker');

class SocketManager {
    constructor(server, walletService) {
        if (!walletService) {
            throw new Error('WalletService è richiesto per SocketManager');
        }
        this.walletService = walletService;

        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true,
                allowedHeaders: ["my-custom-header"]
            },
            allowEIO3: true,
            transports: ['websocket'],
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.io.on('connection', (socket) => {
            logger.info('Client connected:', socket.id);
            
            const monitoredWallets = Array.from(this.walletService.monitoredWallets);
            logger.info('Sending wallet status to client:', {
                walletsCount: monitoredWallets.length,
                wallets: monitoredWallets
            });
            
            socket.emit('walletsStatus', {
                wallets: monitoredWallets,
                status: 'connected'
            });
            
            socket.on('ping', () => {
                socket.emit('pong');
                logger.debug('Ping received, sent pong');
            });

            socket.on('pauseWallet', async ({ wallet }) => {
                logger.info(`Received pause request for wallet: ${wallet}`);
                const success = await this.walletService.pauseWallet(wallet);
                if (success) {
                    this.io.emit('walletUpdate', {
                        wallet,
                        type: 'status',
                        status: 'paused'
                    });
                    logger.info(`Successfully paused monitoring for ${wallet}`);
                } else {
                    logger.error(`Failed to pause monitoring for ${wallet}`);
                }
            });

            socket.on('resumeWallet', async ({ wallet }) => {
                logger.info(`Received resume request for wallet: ${wallet}`);
                const success = await this.walletService.resumeWallet(wallet);
                if (success) {
                    this.io.emit('walletUpdate', {
                        wallet,
                        type: 'status',
                        status: 'resumed'
                    });
                    logger.info(`Successfully resumed monitoring for ${wallet}`);
                } else {
                    logger.error(`Failed to resume monitoring for ${wallet}`);
                }
            });
            
            socket.on('disconnect', () => {
                logger.info('Client disconnected:', socket.id);
            });
        });
    }

    emitTransaction(transactionDetails) {
        try {
            logger.debug('Transaction details:', JSON.stringify(transactionDetails));
            logger.info(`Emitting transaction for wallet ${transactionDetails.wallet}`);
            
            if (!this.io) {
                logger.error('Socket.io instance not initialized');
                return;
            }

            logger.info('Connected clients:', this.io.engine.clientsCount);
            
            this.io.emit('newTransaction', {
                ...transactionDetails,
                timestamp: Date.now()
            });

            if (transactionDetails.wallet) {
                this.io.emit('walletUpdate', {
                    wallet: transactionDetails.wallet,
                    type: 'transaction',
                    transaction: {
                        signature: transactionDetails.signature,
                        timestamp: Date.now(),
                        amount: transactionDetails.amountIn,
                        type: transactionDetails.type
                    }
                });
            }
        } catch (error) {
            logger.error('Errore nell\'emissione della transazione:', error);
            throw error;
        }
    }
}

module.exports = SocketManager;
