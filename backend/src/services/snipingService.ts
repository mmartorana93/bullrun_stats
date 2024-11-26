import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import { walletService } from './walletService';

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

interface SnipeStatus {
  status: 'NOT_IN' | 'IN' | 'ERROR' | 'STOP_LOSS' | 'TAKE_PROFIT';
  message?: string;
  data?: any;
}

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  amount: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: number;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
  outAmount: string;
  otherAmountThreshold: string;
}

class SnipingService {
  private connection: Connection;
  private activeSnipes: Map<string, NodeJS.Timeout>;
  private readonly JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || '');
    this.activeSnipes = new Map();
  }

  // Metodo pubblico per controllare lo stato di uno snipe
  isSnipeActive(tokenAddress: string): boolean {
    return this.activeSnipes.has(tokenAddress);
  }

  // Metodo pubblico per ottenere tutti gli snipe attivi
  getActiveSnipes(): string[] {
    return Array.from(this.activeSnipes.keys());
  }

  private async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<QuoteResponse> {
    const url = `${this.JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const response = await axios.get(url);
    return response.data;
  }

  private async getSwapTransaction(quoteResponse: QuoteResponse, userPublicKey: string): Promise<string> {
    const response = await axios.post(`${this.JUPITER_QUOTE_API}/swap`, {
      quoteResponse,
      userPublicKey,
      wrapUnwrapSOL: true
    });
    return response.data.swapTransaction;
  }

  async startSnipe(config: SnipeConfig): Promise<SnipeStatus> {
    try {
      const keypair = walletService.getKeypair(config.walletId);
      if (!keypair) {
        return { status: 'ERROR', message: 'Wallet non trovato' };
      }

      // Se c'è una data di lancio, calcola il delay
      if (config.launchDate) {
        const now = new Date();
        const delay = config.launchDate.getTime() - now.getTime();
        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            this.executeSnipe(config, keypair);
          }, delay);
          this.activeSnipes.set(config.tokenAddress, timeoutId);
          return { 
            status: 'NOT_IN',
            message: `Snipe programmato per ${config.launchDate.toLocaleString()}`
          };
        }
      }

      // Se non c'è data di lancio o è già passata, esegui subito
      return await this.executeSnipe(config, keypair);
    } catch (error) {
      console.error('Errore nello snipe:', error);
      return {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  private async executeSnipe(config: SnipeConfig, keypair: Keypair): Promise<SnipeStatus> {
    try {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const amountLamports = Math.floor(config.buyAmount * 1e9); // Converti SOL in lamports

      // Ottieni la quote per lo swap
      const quote = await this.getQuote(
        SOL_MINT,
        config.tokenAddress,
        amountLamports,
        config.slippageBps
      );

      if (!quote) {
        return {
          status: 'ERROR',
          message: 'Nessuna route disponibile per questo token'
        };
      }

      // Ottieni la transazione di swap
      const swapTransaction = await this.getSwapTransaction(
        quote,
        keypair.publicKey.toString()
      );

      // Decodifica e firma la transazione
      const transaction = Buffer.from(swapTransaction, 'base64');
      const signedTx = await this.connection.sendRawTransaction(transaction);

      // Avvia il monitoraggio per take profit/stop loss
      this.startPriceMonitoring(config, keypair);

      return {
        status: 'IN',
        message: 'Snipe eseguito con successo',
        data: { txid: signedTx }
      };
    } catch (error) {
      console.error('Errore nell\'esecuzione dello snipe:', error);
      return {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  private async getTokenBalance(tokenMint: string, owner: PublicKey): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        owner
      );
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return Number(balance.value.amount) / Math.pow(10, balance.value.decimals);
    } catch (error) {
      console.error('Errore nel recupero del balance:', error);
      return 0;
    }
  }

  private async startPriceMonitoring(config: SnipeConfig, keypair: Keypair) {
    const monitoringInterval = setInterval(async () => {
      try {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const tokenBalance = await this.getTokenBalance(config.tokenAddress, keypair.publicKey);
        
        if (tokenBalance > 0) {
          // Ottieni il prezzo corrente
          const quote = await this.getQuote(
            config.tokenAddress,
            SOL_MINT,
            Math.floor(tokenBalance * 1e9),
            config.slippageBps
          );

          const currentValue = Number(quote.outAmount) / 1e9 * await this.getSOLPrice();

          if (currentValue <= config.stopLoss || currentValue >= config.takeProfit) {
            // Esegui la vendita
            await this.executeSell(config, keypair, tokenBalance);
            clearInterval(monitoringInterval);
          }
        }
      } catch (error) {
        console.error('Errore nel monitoraggio del prezzo:', error);
      }
    }, 5000); // Controlla ogni 5 secondi
  }

  private async getSOLPrice(): Promise<number> {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
      return Number(response.data.price);
    } catch (error) {
      console.error('Errore nel recupero del prezzo SOL:', error);
      return 0;
    }
  }

  private async executeSell(config: SnipeConfig, keypair: Keypair, amount: number): Promise<void> {
    try {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const amountLamports = Math.floor(amount * 1e9);

      const quote = await this.getQuote(
        config.tokenAddress,
        SOL_MINT,
        amountLamports,
        config.slippageBps
      );

      const swapTransaction = await this.getSwapTransaction(
        quote,
        keypair.publicKey.toString()
      );

      const transaction = Buffer.from(swapTransaction, 'base64');
      await this.connection.sendRawTransaction(transaction);
    } catch (error) {
      console.error('Errore nella vendita:', error);
    }
  }

  stopSnipe(tokenAddress: string): boolean {
    const timeoutId = this.activeSnipes.get(tokenAddress);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeSnipes.delete(tokenAddress);
      return true;
    }
    return false;
  }
}

export const snipingService = new SnipingService();
