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

  // Ottieni l'ID del wallet per lo sniper bot
  getWalletIdForSniper(address: string): string {
    // Per ora, poiché abbiamo un solo wallet, restituiamo sempre "1"
    // In futuro questo metodo potrebbe mappare gli indirizzi agli ID
    return "1";
  }
}

export const walletService = new WalletService();
export type { WalletInfo };
