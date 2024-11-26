import api from '../api/config';
import { Socket } from 'socket.io-client';

export interface TokenHolding {
    symbol: string;
    address: string;
    wallets: {
        address: string;
        amount: number;
    }[];
    invested: number;
    remaining: number;
    sold: number;
    pnl: number | 'N/A';
    pnlPercentage: number | 'N/A';
    source: 'trading' | 'sniping';
    lastPrice: number | null;
    lastUpdate: Date;
    error?: string;
}

export interface HoldingsStats {
    totalInvested: number;
    totalRemaining: number;
    totalSold: number;
    totalPnL: number;
    holdingsCount: number;
    bySource: {
        trading: number;
        sniping: number;
    };
}

class HoldingsService {
    private socket: Socket | null = null;

    setSocket(socket: Socket | null) {
        this.socket = socket;
    }

    async getHoldings(): Promise<TokenHolding[]> {
        try {
            const response = await api.get('/api/holdings');
            return response.data.data;
        } catch (error) {
            console.error('Errore nel recupero degli holdings:', error);
            throw error;
        }
    }

    async getHoldingsByWallet(walletAddress: string): Promise<TokenHolding[]> {
        try {
            const response = await api.get(`/api/holdings/wallet/${walletAddress}`);
            return response.data.data;
        } catch (error) {
            console.error('Errore nel recupero degli holdings per wallet:', error);
            throw error;
        }
    }

    async getHoldingsBySource(source: 'trading' | 'sniping'): Promise<TokenHolding[]> {
        try {
            const response = await api.get(`/api/holdings/source/${source}`);
            return response.data.data;
        } catch (error) {
            console.error('Errore nel recupero degli holdings per fonte:', error);
            throw error;
        }
    }

    async getStats(): Promise<HoldingsStats> {
        try {
            const response = await api.get('/api/holdings/stats');
            return response.data.data;
        } catch (error) {
            console.error('Errore nel recupero delle statistiche:', error);
            throw error;
        }
    }

    async refreshPrices(): Promise<TokenHolding[]> {
        try {
            const response = await api.post('/api/holdings/refresh');
            return response.data.data;
        } catch (error) {
            console.error('Errore nell\'aggiornamento dei prezzi:', error);
            throw error;
        }
    }

    // WebSocket methods
    subscribeToUpdates(callback: (holdings: TokenHolding[]) => void): void {
        if (!this.socket) {
            console.error('WebSocket non disponibile');
            return;
        }

        this.socket.on('holdingsUpdate', callback);
    }

    unsubscribeFromUpdates(callback: (holdings: TokenHolding[]) => void): void {
        if (!this.socket) {
            console.error('WebSocket non disponibile');
            return;
        }

        this.socket.off('holdingsUpdate', callback);
    }

    requestRefresh(): void {
        if (!this.socket) {
            console.error('WebSocket non disponibile');
            return;
        }

        this.socket.emit('refreshHoldings');
    }
}

export const holdingsService = new HoldingsService();
