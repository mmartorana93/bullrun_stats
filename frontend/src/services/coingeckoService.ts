import axios from 'axios';
import CacheService from './cacheService';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

export interface GlobalMarketData {
  btcPrice: number;
  btcDominance: number;
  totalMarketCap: number;
  total2MarketCap: number;
  usdtDominance: number;
}

export const getGlobalMarketData = async (): Promise<GlobalMarketData> => {
  try {
    // Controlla il cache
    const cachedData = CacheService.get('market-data');
    if (cachedData) {
      return cachedData;
    }

    const [globalData, btcData] = await Promise.all([
      axios.get(`${COINGECKO_API_URL}/global`),
      axios.get(`${COINGECKO_API_URL}/simple/price?ids=bitcoin&vs_currencies=usd`)
    ]);

    const data = globalData.data.data;
    const btcPrice = btcData.data.bitcoin.usd;
    const totalMarketCap = data.total_market_cap.usd;
    const total2MarketCap = totalMarketCap * 0.85;
    const btcDominance = data.market_cap_percentage.btc;
    const usdtDominance = data.market_cap_percentage.usdt || 0;

    const result = {
      btcPrice,
      btcDominance,
      totalMarketCap,
      total2MarketCap,
      usdtDominance
    };

    // Salva nel cache
    CacheService.set('market-data', result);

    return result;
  } catch (error) {
    // Se c'è un errore, usa i dati in cache anche se scaduti
    const cachedData = CacheService.get('market-data');
    if (cachedData) {
      console.warn('Usando dati in cache dopo errore API');
      return cachedData;
    }
    console.error('Errore nel recupero dei dati da CoinGecko:', error);
    throw error;
  }
}; 