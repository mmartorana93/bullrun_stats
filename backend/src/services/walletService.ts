import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import base58 from 'bs58';

// Definizione dei tipi per logger e config
interface Logger {
  error: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
}

interface Config {
  SOLANA_RPC_URL: string;
  SOLANA_WS_URL: string;
}

// Importazione con tipi
const { logger } = require('../config/logger') as { logger: Logger };
const config = require('../config/config') as Config;

interface WalletInfo {
  address: string;
  balance: number;
}

class WalletService {
  private connection: Connection;
  private mainWallet: Keypair | null = null;
  private mainWalletAddress: string | null = null;

  constructor() {
    this.connection = new Connection(config.SOLANA_RPC_URL, {
      commitment: 'confirmed',
      wsEndpoint: config.SOLANA_WS_URL
    });

    // Inizializza il wallet usando la chiave privata dal .env
    try {
      const mainPrivateKey = process.env.SOLANA_PRIVATE_KEY;
      if (mainPrivateKey) {
        this.mainWallet = Keypair.fromSecretKey(base58.decode(mainPrivateKey));
        this.mainWalletAddress = this.mainWallet.publicKey.toString();
      }
    } catch (error) {
      logger.error('Errore nell\'inizializzazione del wallet:', error);
    }
  }

  async getMyWalletInfo(): Promise<WalletInfo> {
    try {
      if (!this.mainWalletAddress) {
        throw new Error('MAIN_WALLET non inizializzato correttamente');
      }

      const publicKey = new PublicKey(this.mainWalletAddress);
      const balance = await this.connection.getBalance(publicKey);

      return {
        address: this.mainWalletAddress,
        balance: balance / 1e9
      };
    } catch (error) {
      logger.error('Errore nel recupero info wallet:', error);
      throw error;
    }
  }

  getWalletForSniper() {
    if (!this.mainWallet || !this.mainWalletAddress) {
      throw new Error('MAIN_WALLET non inizializzato correttamente');
    }

    return {
      wallet_name: 'Main Wallet',
      pubkey: this.mainWalletAddress,
      private_key: process.env.SOLANA_PRIVATE_KEY
    };
  }

  getKeypair(walletId: string): Keypair | null {
    // Per ora restituiamo sempre il wallet principale
    // In futuro potremmo gestire più wallet
    return this.mainWallet;
  }
}

export const walletService = new WalletService();
export type { WalletInfo };
