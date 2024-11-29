import { Connection, Keypair } from '@solana/web3.js';
import { walletService } from './walletService';
import { pythonSniper } from './pythonSniper';
import * as fs from 'fs/promises';
import path from 'path';

interface SnipeConfig {
  tokenAddress: string;
  tokenName: string;
  walletId: string;
  buyAmount: number;
  takeProfit: number;
  stopLoss: number;
  slippageBps: number;
  launchDate?: Date;
}

interface SwapConfig {
  tokenAddress: string;
  tokenName: string;
  walletId: string;
  buyAmount: number;
  slippageBps: number;
}

interface SnipeStatus {
  status: 'NOT_IN' | 'IN' | 'ERROR' | 'STOP_LOSS' | 'TAKE_PROFIT';
  message?: string;
  data?: any;
}

class SnipingService {
  private connection: Connection;
  private activeSnipes: Map<string, NodeJS.Timeout>;
  private sniperPath: string;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || '');
    this.activeSnipes = new Map();
    this.sniperPath = path.join(__dirname, '../../../Solana-sniper-bot-main');
    this.initialize();
  }

  private async initialize() {
    try {
      // Ottieni le informazioni del wallet
      const walletInfo = walletService.getWalletForSniper();

      // Aggiorna il file wallets.json dello sniper bot
      const walletsPath = path.join(this.sniperPath, 'wallets.json');
      await fs.writeFile(
        walletsPath,
        JSON.stringify(
          {
            "1": {
              wallet_name: walletInfo.wallet_name,
              pubkey: walletInfo.pubkey,
              private_key: walletInfo.private_key
            }
          },
          null,
          2
        )
      );

      // Aggiorna il file config.json dello sniper bot
      const configPath = path.join(this.sniperPath, 'config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            FIRST_LOGIN: false,
            LAST_WALLET_SELECTED: "1",
            RPC_URL: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
          },
          null,
          2
        )
      );

      // Inizializza il file tokens.json se non esiste
      const tokensPath = path.join(this.sniperPath, 'tokens.json');
      try {
        await fs.access(tokensPath);
      } catch {
        await fs.writeFile(tokensPath, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      console.error('Errore nell\'inizializzazione del servizio di sniper:', error);
      throw error;
    }
  }

  // Metodo pubblico per controllare lo stato di uno snipe
  async isSnipeActive(tokenAddress: string): Promise<boolean> {
    const status = await pythonSniper.getSnipeStatus(tokenAddress);
    return status !== 'NOT_FOUND' && !status.startsWith('>');
  }

  // Metodo pubblico per ottenere tutti gli snipe attivi
  getActiveSnipes(): string[] {
    return Array.from(this.activeSnipes.keys());
  }

  async startSnipe(config: SnipeConfig | SwapConfig): Promise<SnipeStatus> {
    try {
      const keypair = walletService.getKeypair(config.walletId);
      if (!keypair) {
        return { status: 'ERROR', message: 'Wallet non trovato' };
      }

      // Verifica se è uno swap manuale o uno snipe
      const isManualSwap = !('takeProfit' in config);

      if (isManualSwap) {
        // Configura lo swap manuale
        const swapConfig = {
          tokenAddress: config.tokenAddress,
          tokenName: config.tokenName,
          walletId: config.walletId,
          buyAmount: config.buyAmount,
          slippageBps: config.slippageBps,
          timestamp: undefined // Usa undefined invece di null
        };

        // Esegui lo swap immediatamente
        await pythonSniper.addTokenToSnipe(swapConfig);

        return {
          status: 'IN',
          message: 'Swap avviato'
        };
      } else {
        // È uno snipe normale
        const snipeConfig = config as SnipeConfig;
        const pythonConfig = {
          tokenAddress: snipeConfig.tokenAddress,
          tokenName: snipeConfig.tokenName,
          walletId: snipeConfig.walletId,
          buyAmount: snipeConfig.buyAmount,
          takeProfit: snipeConfig.takeProfit,
          stopLoss: snipeConfig.stopLoss,
          slippageBps: snipeConfig.slippageBps,
          timestamp: snipeConfig.launchDate ? Math.floor(snipeConfig.launchDate.getTime() / 1000) : undefined
        };

        await pythonSniper.addTokenToSnipe(pythonConfig);

        return {
          status: 'NOT_IN',
          message: snipeConfig.launchDate 
            ? `Snipe programmato per ${snipeConfig.launchDate.toLocaleString()}`
            : 'Snipe avviato'
        };
      }
    } catch (error) {
      console.error('Errore nello snipe/swap:', error);
      return {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  async stopSnipe(tokenAddress: string): Promise<boolean> {
    try {
      return await pythonSniper.stopSnipe(tokenAddress);
    } catch (error) {
      console.error('Errore nel fermare lo snipe:', error);
      return false;
    }
  }

  async getSnipeStatus(tokenAddress: string): Promise<SnipeStatus> {
    try {
      const status = await pythonSniper.getSnipeStatus(tokenAddress);
      
      switch (status) {
        case 'NOT_IN':
          return { status: 'NOT_IN', message: 'In attesa di esecuzione' };
        case 'IN':
          return { status: 'IN', message: 'Posizione aperta' };
        case '> STOP_LOSS':
          return { status: 'STOP_LOSS', message: 'Stop loss raggiunto' };
        case '> TAKE_PROFIT':
          return { status: 'TAKE_PROFIT', message: 'Take profit raggiunto' };
        case 'ERROR WHEN SWAPPING':
          return { status: 'ERROR', message: 'Errore durante lo swap' };
        default:
          return { status: 'ERROR', message: 'Stato sconosciuto' };
      }
    } catch (error) {
      console.error('Errore nel recupero dello stato:', error);
      return { status: 'ERROR', message: 'Errore nel recupero dello stato' };
    }
  }
}

export const snipingService = new SnipingService();
