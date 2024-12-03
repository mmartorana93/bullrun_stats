import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';

interface TokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          tokenAmount: {
            uiAmount: number;
          };
          mint: string;
        };
      };
    };
  };
}

interface JupiterPriceResponseV2 {
  data: {
    [key: string]: {
      id: string;
      type: string;
      price: string;
    }
  }
}

interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

interface TokenMetadata {
  price: number;
  symbol: string;
  name?: string;
}

// Lista di token da ignorare (scam/falliti)
const BLACKLISTED_TOKENS = [
  "3rcwsZ86w1npjDBmXBL3XSxxK6TcwSPzXFSuCx2kTFP4",
  "4PUzYSHYrGGRxPdxHhr9aohhTfsQjkgAEMSYzhSraaBU",
  "DtqM56GC8n3as12oF6bQ1vCKjR294zygLchN6tgXwq4q",
  "MWDdkqHWeoGuTS36krDuRjWA1St9yi2SUdQssxLSbNm",
  "ARQwH1iKsmBLEnArct9Qv7LKyTCSeeC3zB6BVQMNizC6",
  "3YWLuAW8vPzzZrWLNcfaTKKyEFwukXG6wfP9ej1WDGty",
  "8VGntkLPxeoS8FCcgA4qvyT4PpYiP2VfCq18stg6iNp4",
  "FBbWk6kC5r66WgEBKEbVs121qNLRfQwpNfdaKfJanWWL",
  "Fqs7sHHyzyQh7ZmZq6Jv3uPzrrSXQWe3bHEREhrJpump",
  "CnHFiwyWA8ppKJ1UYjCFuYXK1HAK91gC4zzxjv4xXxXJ",
  "8ApwmGqp4anzdW5kqm6N4qNFbLMfbGciijrD2ZBPQz9u",
  "7xEdKtj6nX2nvqPGayLi4egSWwr53NYSaVZQLRLapump",
  "HVAn4Z7GazxCDRXvp5MLv9AFrKkxfGLih4sXutedeevk",
  "Wdh8V9VVh1QwvreuNLmads3B7dK3FUkyGHXwkRPCgPX",
  "DeDQFhjhM1W8Cftc3Jr6Rhk6d2pq4qrkk4yXebGXp5jB"
];

async function getBatchTokenInfo(mints: string[]): Promise<Map<string, TokenMetadata>> {
  const tokenMap = new Map<string, TokenMetadata>();

  try {
    const priceResponse = await axios.get<JupiterPriceResponseV2>(
      `https://api.jup.ag/price/v2?ids=${mints.join(',')}`
    );

    for (const mint of mints) {
      try {
        const tokenResponse = await axios.get<JupiterTokenInfo>(
          `https://tokens.jup.ag/token/${mint}`
        );

        const priceInfo = priceResponse.data.data[mint];
        tokenMap.set(mint, {
          price: priceInfo ? Number(priceInfo.price) : 0,
          symbol: tokenResponse.data.symbol || mint.slice(0, 4) + '...',
          name: tokenResponse.data.name
        });
      } catch {
        if (priceResponse.data.data[mint]) {
          tokenMap.set(mint, {
            price: Number(priceResponse.data.data[mint].price),
            symbol: mint.slice(0, 4) + '...'
          });
        }
      }
    }
  } catch (error) {
    console.error('Errore nel recupero dei prezzi:', error);
  }
  return tokenMap;
}

async function getWalletTokens(walletAddress: string, rpcUrl: string): Promise<void> {
  try {
    const connection = new Connection(rpcUrl);
    const publicKey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: TOKEN_PROGRAM_ID
      }
    );

    const relevantMints = tokenAccounts.value
      .map(ta => ta.account.data.parsed.info)
      .filter(info => info.tokenAmount.uiAmount > 0)
      .filter(info => !BLACKLISTED_TOKENS.includes(info.mint))
      .map(info => info.mint);

    relevantMints.push("So11111111111111111111111111111111111111112");

    const tokenInfo = await getBatchTokenInfo(relevantMints);

    console.log("\nToken nel wallet:");
    console.log("------------------");

    let totalValueUSD = 0;

    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed.info;
      const amount = accountData.tokenAmount.uiAmount;
      const mint = accountData.mint;
      
      if (amount > 0 && !BLACKLISTED_TOKENS.includes(mint)) {
        const info = tokenInfo.get(mint);
        const value = info?.price ? amount * info.price : 0;
        totalValueUSD += value;
        
        console.log(`Token: ${info?.name || info?.symbol || 'Unknown'}`);
        console.log(`Address: ${mint}`);
        console.log(`Amount: ${amount.toLocaleString()}`);
        if (info?.price) {
          console.log(`Price: $${info.price.toFixed(4)}`);
          console.log(`Value: $${value.toFixed(2)}`);
        }
        console.log("------------------");
      }
    }

    // SOL balance
    const solBalance = await connection.getBalance(publicKey);
    const solInfo = tokenInfo.get("So11111111111111111111111111111111111111112");
    const solBalanceNum = solBalance / 1e9;
    console.log(`SOL Balance: ${solBalanceNum.toLocaleString()} SOL`);
    if (solInfo?.price) {
      const solValue = solBalanceNum * solInfo.price;
      totalValueUSD += solValue;
      console.log(`SOL Price: $${solInfo.price.toFixed(4)}`);
      console.log(`SOL Value: $${solValue.toFixed(2)}`);
    }

    console.log("------------------");
    console.log(`Valore Totale Portfolio: $${totalValueUSD.toFixed(2)}`);

  } catch (error) {
    console.error('Errore nel recupero dei token:', error);
  }
}

async function getTokenPrice(tokenIdentifier: string): Promise<void> {
  try {
    // Usando la v2 dell'API dei prezzi come da documentazione
    const response = await axios.get<JupiterPriceResponseV2>(
      `https://api.jup.ag/price/v2?ids=${tokenIdentifier}`
    );

    if (response.data.data[tokenIdentifier]) {
      const tokenData = response.data.data[tokenIdentifier];
      console.log('\nInformazioni del token:');
      console.log('------------------------');
      console.log(`Token ID: ${tokenData.id}`);
      console.log(`Price: $${Number(tokenData.price).toFixed(4)}`);
      console.log(`Price Type: ${tokenData.type}`);
    } else {
      console.log('\nToken non trovato o prezzo non disponibile');
    }
  } catch (error) {
    console.error('Errore nel recupero del prezzo:', error);
  }
}

interface PriceMonitorConfig {
  tokens: string[];
  interval: number; // millisecondi
  onPriceUpdate: (prices: Map<string, number>) => void;
}

class PriceMonitor {
  private isRunning: boolean = false;
  private lastPrices: Map<string, number> = new Map();
  private config: PriceMonitorConfig;

  // Rate limit: 600 req/min = 1 req/100ms
  private static MIN_INTERVAL = 100; // minimo intervallo tra le richieste
  private static BATCH_SIZE = 100; // massimo numero di token per richiesta

  constructor(config: PriceMonitorConfig) {
    this.config = {
      ...config,
      interval: Math.max(config.interval, PriceMonitor.MIN_INTERVAL)
    };
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        const priceResponse = await axios.get<JupiterPriceResponseV2>(
          `https://api.jup.ag/price/v2?ids=${this.config.tokens.join(',')}`
        );

        const newPrices = new Map<string, number>();
        
        for (const token of this.config.tokens) {
          const priceInfo = priceResponse.data.data[token];
          if (priceInfo) {
            const price = Number(priceInfo.price);
            newPrices.set(token, price);
            
            // Controlla se il prezzo è cambiato
            const oldPrice = this.lastPrices.get(token);
            if (oldPrice !== price) {
              console.log(`${new Date().toISOString()} - ${token} Price Update: $${price.toFixed(4)}`);
            }
          }
        }

        this.lastPrices = newPrices;
        this.config.onPriceUpdate(newPrices);

        await new Promise(resolve => setTimeout(resolve, this.config.interval));
      } catch (error) {
        console.error('Errore nel monitoraggio prezzi:', error);
        // Aspetta un po' più a lungo in caso di errore
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  stop() {
    this.isRunning = false;
  }
}

// Esempio di utilizzo
async function startPriceMonitoring(tokens: string[]) {
  const monitor = new PriceMonitor({
    tokens,
    interval: 1000, // Aggiorna ogni secondo
    onPriceUpdate: (prices) => {
      // Qui puoi fare qualcosa con i prezzi aggiornati
      // Per esempio, salvare in un database o aggiornare UI
    }
  });

  await monitor.start();
  return monitor;
}

// Modifica la parte finale dello script
const WALLET_ADDRESS = "CiZJrmPUKs3WC8UPHibGpVbMjaq7M9VL84XZFXYosrfK";
const RPC_URL = "https://api.mainnet-beta.solana.com";

// Prima mostra i token nel wallet
getWalletTokens(WALLET_ADDRESS, RPC_URL).then(() => {
  // Poi inizia il monitoraggio dei prezzi per i token attivi
  const tokensToMonitor = ["ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY"];
  startPriceMonitoring(tokensToMonitor);
}); 