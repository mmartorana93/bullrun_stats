export interface Transaction {
    wallet: string;
    timestamp: string;
    amount_sol: number;
    success: boolean;
    type: 'send' | 'receive';
    signature: string;
}

export interface WalletResponse {
    message?: string;
    error?: string;
}
