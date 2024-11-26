import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger, writeLogToFile } from '../config/logger';
import { walletService, MonitoredWallet } from '../services/walletService';
import { holdingsService, FormattedHolding } from '../services/holdingsService';

interface TransactionDetails {
    wallet: string;
    signature: string;
    type: string;
    amountIn?: number;
    amountOut?: number;
    tokenIn?: any;
    tokenOut?: any;
    timestamp?: number;
    [key: string]: any;
}

interface WalletUpdate {
    wallet: string;
    type: 'status' | 'transaction';
    status?: 'active' | 'paused';
    transaction?: {
        signature: string;
        timestamp: number;
        amount: number;
        type: string;
    };
}

class SocketManager {
    private io: SocketServer;
    private readonly UPDATE_INTERVAL = 30000; // 30 secondi
    private updateTimer?: NodeJS.Timeout;

    constructor(server: HttpServer) {
        this.io = new SocketServer(server, {
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

        this.initializeSocketHandlers();
        this.initializeHoldingsListener();
        this.startPeriodicUpdates();
    }

    private initializeSocketHandlers(): void {
        this.io.on('connection', (socket) => {
            logger.info('Client connected:', socket.id);
            
            // Invia lo stato iniziale
            this.sendInitialState(socket);
            
            socket.on('ping', () => {
                socket.emit('pong');
                logger.debug('Ping received, sent pong');
            });

            socket.on('pauseWallet', async ({ wallet }) => {
                logger.info(`Received pause request for wallet: ${wallet}`);
                const success = await walletService.pauseWallet(wallet);
                if (success) {
                    this.emitWalletUpdate({
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
                const success = await walletService.resumeWallet(wallet);
                if (success) {
                    this.emitWalletUpdate({
                        wallet,
                        type: 'status',
                        status: 'active'
                    });
                    logger.info(`Successfully resumed monitoring for ${wallet}`);
                } else {
                    logger.error(`Failed to resume monitoring for ${wallet}`);
                }
            });

            socket.on('refreshHoldings', async () => {
                await this.refreshData();
            });
            
            socket.on('disconnect', () => {
                logger.info('Client disconnected:', socket.id);
            });
        });
    }

    private initializeHoldingsListener(): void {
        // Ascolta gli aggiornamenti degli holdings
        holdingsService.on('holdingsUpdate', (holdings: FormattedHolding[]) => {
            this.io.emit('holdingsUpdate', holdings);
        });
    }

    private async sendInitialState(socket: any): Promise<void> {
        try {
            // Invia lo stato dei wallet
            const monitoredWallets = await walletService.getMonitoredWallets();
            socket.emit('walletsStatus', {
                wallets: monitoredWallets,
                status: 'connected'
            });

            // Invia gli holdings attuali
            const holdings = await holdingsService.getHoldings();
            socket.emit('holdingsUpdate', holdings);
        } catch (error) {
            logger.error('Error sending initial state:', error);
        }
    }

    private startPeriodicUpdates(): void {
        this.updateTimer = setInterval(() => {
            this.refreshData();
        }, this.UPDATE_INTERVAL);
    }

    private async refreshData(): Promise<void> {
        try {
            // Aggiorna i prezzi degli holdings
            await holdingsService.refreshPrices();

            // Aggiorna lo stato dei wallet
            const monitoredWallets = await walletService.getMonitoredWallets();
            this.io.emit('walletsStatus', {
                wallets: monitoredWallets,
                status: 'connected'
            });
        } catch (error) {
            logger.error('Error refreshing data:', error);
        }
    }

    public async emitTransaction(transactionDetails: TransactionDetails): Promise<void> {
        try {
            logger.debug('Transaction details:', JSON.stringify(transactionDetails));
            logger.info(`Emitting transaction for wallet ${transactionDetails.wallet}`);
            
            // Log dettagliato della transazione
            const detailedLog = JSON.stringify({
                timestamp: new Date().toISOString(),
                wallet: transactionDetails.wallet,
                signature: transactionDetails.signature,
                type: transactionDetails.type,
                amountIn: transactionDetails.amountIn,
                amountOut: transactionDetails.amountOut,
                tokenIn: transactionDetails.tokenIn,
                tokenOut: transactionDetails.tokenOut,
                rawData: transactionDetails
            }, null, 2);

            await writeLogToFile('transactionsLogs', detailedLog);
            
            if (!this.io) {
                logger.error('Socket.io instance not initialized');
                return;
            }

            logger.info('Connected clients:', this.io.engine.clientsCount);
            
            // Emetti la transazione
            this.io.emit('newTransaction', {
                ...transactionDetails,
                timestamp: Date.now()
            });

            // Aggiorna lo stato del wallet
            if (transactionDetails.wallet) {
                this.emitWalletUpdate({
                    wallet: transactionDetails.wallet,
                    type: 'transaction',
                    transaction: {
                        signature: transactionDetails.signature,
                        timestamp: Date.now(),
                        amount: transactionDetails.amountIn || 0,
                        type: transactionDetails.type
                    }
                });
            }

            // Aggiorna gli holdings se necessario
            if (transactionDetails.type === 'swap' || 
                transactionDetails.type === 'buy' || 
                transactionDetails.type === 'sell') {
                holdingsService.emit('newTransaction', transactionDetails);
            }
        } catch (error) {
            logger.error('Errore nell\'emissione della transazione:', error);
            throw error;
        }
    }

    private emitWalletUpdate(update: WalletUpdate): void {
        this.io.emit('walletUpdate', update);
    }

    public cleanup(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.io.close();
    }
}

export default SocketManager;
