export interface TokenDetails {
    address: string;
    symbol: string;
    decimals: number;
    priceUsd: string;
    dexScreenerUrl: string;
    createdAt?: number;
}

export interface TokenChange {
    tokenAddress: string;
    preAmount: string;
    postAmount: string;
    decimals: number;
}

export interface Links {
    dexScreener: string;
    photon: string;
    rugcheck: string;
}

export interface BalanceInfo {
    sol: number;
    token: number;
}

export interface Transaction {
    signature: string;
    timestamp: string;
    wallet: string;
    type: 'send' | 'receive' | 'swap';
    amount_sol: number;
    success: boolean;
    token?: TokenDetails;
    tokenSymbol?: string;
    tokenAddress?: string;
    tokenAmount?: number;
    links?: Links;
    preBalances?: BalanceInfo;
    postBalances?: BalanceInfo;
    tokenChanges?: TokenChange[];
    logMessages?: string[];
    age?: number;
}

export interface WalletResponse {
    message?: string;
    error?: string;
}
