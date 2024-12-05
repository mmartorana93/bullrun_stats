import api from '../api/config';

export interface TokenHolding {
    symbol: string;
    name?: string;
    address: string;
    amount: number;
    price: number;
    value: number;
}

export interface WalletTokensResponse {
    tokens: TokenHolding[];
    solBalance: number;
    solPrice: number;
    solValue: number;
    totalValueUSD: number;
}

class HoldingsService {
    async getMyTokens(): Promise<WalletTokensResponse> {
        try {
            const response = await api.get('/api/holdings/my-tokens');
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.error || 'Errore nel recupero dei token');
        } catch (error) {
            console.error('Errore nel recupero dei token:', error);
            throw error;
        }
    }

    async refreshPrices(): Promise<WalletTokensResponse> {
        try {
            const response = await api.post('/api/holdings/refresh-prices');
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.error || 'Errore nell\'aggiornamento dei prezzi');
        } catch (error) {
            console.error('Errore nell\'aggiornamento dei prezzi:', error);
            throw error;
        }
    }
}

export const holdingsService = new HoldingsService();
