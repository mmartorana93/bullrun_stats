const { Server } = require('socket.io');
const { Connection, PublicKey } = require('@solana/web3.js');
const { logger } = require('../config/logger');
const transactionTracker = require('../utils/transactionTracker');

class SocketManager {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"]
            },
            transports: ['websocket']
        });

        this.io.on('connection', (socket) => {
            logger.info('Client connected:', socket.id);
            
            socket.on('disconnect', () => {
                logger.info('Client disconnected:', socket.id);
            });
        });
    }

    emitTransaction(transactionDetails) {
        try {
            logger.info('Emitting transaction:', transactionDetails.signature);
            
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
