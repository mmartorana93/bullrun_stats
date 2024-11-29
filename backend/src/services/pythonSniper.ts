import { spawn } from 'child_process';
import path from 'path';

interface PythonSnipeConfig {
  tokenAddress: string;
  tokenName: string;
  walletId: string;
  buyAmount: number;
  takeProfit: number;
  stopLoss: number;
  slippageBps: number;
  timestamp?: number;
}

interface PythonSwapConfig {
  tokenAddress: string;
  tokenName: string;
  walletId: string;
  buyAmount: number;
  slippageBps: number;
  timestamp?: number;
}

interface TokenConfig {
  NAME: string;
  ADDRESS: string;
  WALLET: string;
  BUY_AMOUNT: number;
  TAKE_PROFIT?: number;
  STOP_LOSS?: number;
  SLIPPAGE_BPS: number;
  TIMESTAMP: number | null;
  STATUS: string;
}

interface TokensJson {
  [key: string]: TokenConfig;
}

class PythonSniperWrapper {
  private sniperPath: string;

  constructor() {
    // Path alla directory dello sniper bot Python
    this.sniperPath = path.join(__dirname, '../../../Solana-sniper-bot-main');
  }

  async addTokenToSnipe(config: PythonSnipeConfig | PythonSwapConfig): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Leggi il file tokens.json
        const tokensPath = path.join(this.sniperPath, 'tokens.json');
        const fs = require('fs');
        const tokens: TokensJson = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

        // Aggiungi il nuovo token
        const tokenId = Object.keys(tokens).length + 1;
        
        // Verifica se è uno swap manuale o uno snipe
        const isManualSwap = !('takeProfit' in config);

        tokens[tokenId] = {
          NAME: config.tokenName,
          ADDRESS: config.tokenAddress,
          WALLET: config.walletId,
          BUY_AMOUNT: config.buyAmount,
          SLIPPAGE_BPS: config.slippageBps,
          TIMESTAMP: config.timestamp || null,
          STATUS: 'NOT IN'
        };

        // Aggiungi takeProfit e stopLoss solo se è uno snipe
        if (!isManualSwap) {
          const snipeConfig = config as PythonSnipeConfig;
          tokens[tokenId].TAKE_PROFIT = snipeConfig.takeProfit;
          tokens[tokenId].STOP_LOSS = snipeConfig.stopLoss;
        }

        // Salva il file aggiornato
        fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));

        // Avvia il processo Python
        this.startPythonProcess();

        resolve(true);
      } catch (error) {
        console.error('Errore nell\'aggiunta del token:', error);
        reject(error);
      }
    });
  }

  private startPythonProcess() {
    const pythonProcess = spawn('python3', ['main.py'], {
      cwd: this.sniperPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
    });
  }

  async stopSnipe(tokenAddress: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Leggi il file tokens.json
        const tokensPath = path.join(this.sniperPath, 'tokens.json');
        const fs = require('fs');
        const tokens: TokensJson = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

        // Trova e rimuovi il token
        let found = false;
        for (const [id, token] of Object.entries(tokens)) {
          if (token.ADDRESS === tokenAddress) {
            delete tokens[id];
            found = true;
            break;
          }
        }

        if (found) {
          // Salva il file aggiornato
          fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
          
          // Riavvia il processo Python
          this.startPythonProcess();
          
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        console.error('Errore nella rimozione del token:', error);
        reject(error);
      }
    });
  }

  async getSnipeStatus(tokenAddress: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Leggi il file tokens.json
        const tokensPath = path.join(this.sniperPath, 'tokens.json');
        const fs = require('fs');
        const tokens: TokensJson = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

        // Trova lo stato del token
        for (const token of Object.values(tokens)) {
          if (token.ADDRESS === tokenAddress) {
            resolve(token.STATUS);
            return;
          }
        }

        resolve('NOT_FOUND');
      } catch (error) {
        console.error('Errore nel recupero dello stato:', error);
        reject(error);
      }
    });
  }
}

export const pythonSniper = new PythonSniperWrapper();
export type { PythonSnipeConfig, PythonSwapConfig };
