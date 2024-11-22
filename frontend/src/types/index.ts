export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    priceUsd: number;
    dexScreenerUrl: string;
    createdAt?: number;
    name?: string;
}

export interface TokenChange {
    tokenAddress: string;
    preAmount: string;
    postAmount: string;
    decimals: number;
}

export interface Links {
    dexscreener: string;
    photon: string;
    rugcheck: string;
}

export interface BalanceInfo {
    sol: number;
    token: number;
}

export interface Transaction {
    signature: string;
    wallet: string;
    type: string;
    amount_sol: number;
    tokenAmount?: number;
    success: boolean;
    timestamp: string | number;
    token?: TokenInfo;
    preBalances?: {
        sol: number;
        token: number;
    };
    postBalances?: {
        sol: number;
        token: number;
    };
    links?: {
        photon: string;
        rugcheck: string;
    };
}

export interface WalletResponse {
    message?: string;
    error?: string;
}
