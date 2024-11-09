import axios from 'axios';
import * as raxios from 'retry-axios';

// Configurazione del client axios con retry
const dextoolsClient = axios.create({
    baseURL: 'https://public-api.dextools.io/trial/v2',
    timeout: 10000,
    headers: {
        'accept': 'application/json',
        'X-API-KEY': process.env.REACT_APP_DEXTOOLS_API_KEY || ''
    }
});

// Configurazione del sistema di retry
const raxConfig = {
    retry: 3,
    noResponseRetries: 2,
    retryDelay: 1000,
    httpMethodsToRetry: ['GET'],
    statusCodesToRetry: [[408, 429], [500, 599]],
    backoffType: 'exponential' as const,
    onRetryAttempt: (err: any) => {
        const cfg = raxios.getConfig(err);
        console.log(`Retry attempt #${cfg?.currentRetryAttempt} for DexTools API`);
    }
};

dextoolsClient.defaults.raxConfig = raxConfig;
raxios.attach(dextoolsClient);

export interface TokenPrice {
    price: number;
    timestamp: number;
}

export interface PriceHistory {
    prices: TokenPrice[];
    timeRange: string;
}

export const dextoolsService = {
    async getTokenPrice(tokenAddress: string): Promise<number | null> {
        try {
            const response = await dextoolsClient.get(`/token/solana/${tokenAddress}/price`);
            const price = response.data?.data?.price;
            return price ? parseFloat(price) : null;
        } catch (error) {
            console.error('Error fetching token price from DexTools:', error);
            throw error;
        }
    },

    async getTokenPriceHistory(
        tokenAddress: string, 
        timeRange: '1h' | '24h' | '7d' = '24h'
    ): Promise<PriceHistory | null> {
        try {
            const response = await dextoolsClient.get(
                `/token/solana/${tokenAddress}/price/${timeRange}`
            );
            
            if (!response.data?.data?.prices) {
                return null;
            }

            return {
                prices: response.data.data.prices.map((p: any) => ({
                    price: parseFloat(p.price),
                    timestamp: new Date(p.timestamp).getTime()
                })),
                timeRange
            };
        } catch (error) {
            console.error('Error fetching token price history from DexTools:', error);
            throw error;
        }
    },

    async getTokenMetadata(tokenAddress: string): Promise<any> {
        try {
            const response = await dextoolsClient.get(`/token/solana/${tokenAddress}`);
            return response.data?.data || null;
        } catch (error) {
            console.error('Error fetching token metadata from DexTools:', error);
            throw error;
        }
    }
};
