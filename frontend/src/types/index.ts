export interface Transaction {
    signature: string;
    timestamp: string;
    wallet: string;
    amount_sol: number;
    success: boolean;
    type: 'send' | 'receive' | 'BUY' | 'SELL';
    tokenSymbol?: string;
    tokenAddress?: string;
    age?: number;
}

export interface WalletResponse {
    message?: string;
    error?: string;
}
