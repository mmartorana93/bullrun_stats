import api from '../api/config';
import { AxiosError } from 'axios';

interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
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
  async executeSwap(params: SwapParams): Promise<SwapResponse> {
    try {
      // Converti l'amount in lamports
      const lamports = Math.floor(params.amount * 1e9).toString();
      
      // Assicurati che tutti i parametri siano nel formato corretto
      const formattedParams = {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: lamports,
        slippageBps: Math.floor(params.slippageBps)
      };

      console.log('Parametri di swap:', {
        ...formattedParams,
        amountInSol: params.amount,
        amountInLamports: lamports
      });
      
      const response = await api.post('/api/sniper/swap', formattedParams);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore durante lo swap');
      }

      return response.data;
    } catch (error) {
      console.error('Errore durante lo swap:', error);
      
      if (error instanceof AxiosError && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        const errorData = error.response.data as ApiErrorResponse;
        const errorMessage = errorData.error || errorData.message || error.message;
        
        if (errorData.details) {
          console.error('Error details:', errorData.details);
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto durante lo swap'
      };
    }
  }

  async getQuote(inputMint: string, outputMint: string, amount: number): Promise<QuoteResponse> {
    try {
      // Converti l'amount in lamports
      const lamports = Math.floor(amount * 1e9).toString();

      console.log('Richiesta quotazione:', {
        inputMint,
        outputMint,
        amountInSol: amount,
        amountInLamports: lamports
      });

      const response = await api.get('/api/sniper/quote', {
        params: {
          inputMint,
          outputMint,
          amount: lamports
        }
      });

      // La risposta contiene l'intera quotazione da Jupiter
      if (response.data.success && response.data.data) {
        return {
          success: true,
          data: response.data.data // Passa l'intera risposta della quotazione
        };
      }

      return response.data;
    } catch (error) {
      console.error('Errore nel recupero della quotazione:', error);
      
      if (error instanceof AxiosError && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        const errorData = error.response.data as ApiErrorResponse;
        const errorMessage = errorData.error || errorData.message || error.message;
        
        if (errorData.details) {
          console.error('Error details:', errorData.details);
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore nel recupero della quotazione'
      };
    }
  }

  // Utility per formattare i numeri in lamports
  private toLamports(sol: number): string {
    return Math.floor(sol * 1e9).toString();
  }
}

export const tradingService = new TradingService();
