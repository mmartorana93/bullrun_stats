export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  priceUsd: string;
  dexScreenerUrl: string;
}

export interface Links {
  dexScreener: string;
  photon: string;
  rugcheck: string;
}

export interface Balances {
  sol: number;
  token: number;
}

export interface Transaction {
  signature: string;
  timestamp: string;
  wallet: string;
  type: 'swap' | 'send' | 'receive';
  amount_sol: number;
  success: boolean;
  token?: TokenInfo;
  tokenAmount?: number;
  links?: Links;
  preBalances?: Balances;
  postBalances?: Balances;
}

export interface IncomingTransaction {
  signature: string;
  timestamp: string;
  wallet: string;
  type: string;
  amount_sol?: number;
  amount?: number;
  success?: boolean;
  tokenSymbol?: string;
  tokenAddress?: string;
  age?: number;
}

export interface IncomingSwapTransaction extends IncomingTransaction {
  token?: TokenInfo;
  tokenAmount?: number;
  links?: Links;
  preBalances?: Balances;
  postBalances?: Balances;
}

export interface WalletResponse {
  address: string;
  balance: number;
  transactions?: Transaction[];
  message?: string;
} 