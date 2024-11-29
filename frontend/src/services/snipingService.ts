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

interface SnipeResponse {
  success: boolean;
  message?: string;
  stopped?: boolean;
  status?: string;
  data?: any;
}

type PanelMode = 'manual' | 'sniper';
type TradingMode = 'buy' | 'sell';

class SnipingService {
  private readonly API_URL = '/api/snipe';

  async startSnipe(config: SnipeConfig | SwapConfig): Promise<SnipeResponse> {
    try {
      const response = await fetch(`${this.API_URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      return await response.json();
    } catch (error) {
      console.error('Errore nell\'avvio dello snipe:', error);
      throw error;
    }
  }

  async stopSnipe(tokenAddress: string): Promise<SnipeResponse> {
    try {
      const response = await fetch(`${this.API_URL}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenAddress }),
      });

      return await response.json();
    } catch (error) {
      console.error('Errore nel fermare lo snipe:', error);
      throw error;
    }
  }

  async getSnipeStatus(tokenAddress: string): Promise<SnipeStatus> {
    try {
      const response = await fetch(`${this.API_URL}/status/${tokenAddress}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Errore nel recupero dello stato:', error);
      throw error;
    }
  }

  async getActiveSnipes(): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_URL}/active`);
      const data = await response.json();
      return data.activeSnipes;
    } catch (error) {
      console.error('Errore nel recupero degli snipe attivi:', error);
      throw error;
    }
  }
}

export const snipingService = new SnipingService();
export type { 
  SnipeConfig, 
  SwapConfig, 
  SnipeStatus, 
  SnipeResponse,
  PanelMode,
  TradingMode
};
