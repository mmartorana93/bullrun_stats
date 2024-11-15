export interface TokenDetails {
    address: string;
    symbol: string;
    createdAt: number;
    dexScreenerUrl: string;
    priceUsd: string;
}

export interface Transaction {
    signature: string;
    timestamp: string;
    wallet: string;
    type: 'send' | 'receive';
    amount_sol: number;
    success: boolean;
    blockTime?: number;
    token?: TokenDetails;
    logMessages?: string[];
    rawLogs?: string[];
    tokenChanges?: {
        tokenAddress: string;
        preAmount: string;
        postAmount: string;
    }[];
    tokenSymbol?: string;
    tokenAddress?: string;
    age?: number;
}

export interface WalletResponse {
    message?: string;
    error?: string;
}
