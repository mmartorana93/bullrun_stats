import api from '../api/config';
import { AxiosError } from 'axios';
import { TRADING_CONSTANTS } from '../lib/constants/trading';

interface OptimizedSwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  isInputSol: boolean;
  isOutputSol: boolean;
  priorityFee: number;
  skipPreflight: boolean;
  maxRetries: number;
}

interface QuoteResponse {
  success: boolean;
  data?: any; // La risposta completa della quotazione da Jupiter
  error?: string;
}

interface SwapResponse {
  success: boolean;
  transactionHash?: string;
  message?: string;
  error?: string;
}

interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, string>;
}

class TradingService {
  async executeSwap(params: OptimizedSwapParams): Promise<SwapResponse> {
    try {
      console.log('[TradingService] Invio richiesta swap:', {
        ...params,
        isInputSol: params.inputMint === TRADING_CONSTANTS.SOL_ADDRESS
      });

      const response = await api.post('/api/sniper/swap', params);
      console.log('[TradingService] Risposta swap ricevuta:', response.data);
      return response.data;
    } catch (error) {
      console.error('[TradingService] Errore swap:', error);
      if (error instanceof AxiosError && error.response) {
        console.error('[TradingService] Dettagli errore swap:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      throw error;
    }
  }

  async getQuote(inputMint: string, outputMint: string, amount: number): Promise<QuoteResponse> {
    try {
      const amountToSend = inputMint === TRADING_CONSTANTS.SOL_ADDRESS ? 
        Math.floor(amount * 1e9).toString() : 
        amount.toString();

      console.log('[TradingService] Invio richiesta quote:', {
        inputMint,
        outputMint,
        originalAmount: amount,
        convertedAmount: amountToSend,
        isInputSol: inputMint === TRADING_CONSTANTS.SOL_ADDRESS
      });

      const response = await api.get('/api/sniper/quote', {
        params: {
          inputMint,
          outputMint,
          amount: amountToSend
        }
      });

      console.log('[TradingService] Risposta quote ricevuta:', response.data);
      return response.data;
    } catch (error) {
      console.error('[TradingService] Errore quote:', error);
      if (error instanceof AxiosError && error.response) {
        console.error('[TradingService] Dettagli errore:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      throw error;
    }
  }

  // Utility per formattare i numeri in lamports
  private toLamports(sol: number): string {
    return Math.floor(sol * 1e9).toString();
  }
}

export const tradingService = new TradingService();
