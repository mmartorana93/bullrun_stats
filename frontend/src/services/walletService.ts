import api from '../api/config';

interface WalletInfo {
  address: string;
  balance: number;
  isTestWallet: boolean;
}

class WalletService {
  async getMyWallet(): Promise<WalletInfo> {
    try {
      const response = await api.get('/api/wallets/my-wallet');
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero info wallet:', error);
      throw error;
    }
  }
}

export const walletService = new WalletService();
export type { WalletInfo };
