import axios from 'axios';

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
    const [globalData, btcData] = await Promise.all([
      axios.get(`${COINGECKO_API_URL}/global`),
      axios.get(`${COINGECKO_API_URL}/simple/price?ids=bitcoin&vs_currencies=usd`)
    ]);

    const data = globalData.data.data;
    const btcPrice = btcData.data.bitcoin.usd;
    const totalMarketCap = data.total_market_cap.usd;
    const total2MarketCap = totalMarketCap * 0.85; // Approssimazione per Total2
    const btcDominance = data.market_cap_percentage.btc;
    const usdtDominance = data.market_cap_percentage.usdt || 0;

    return {
      btcPrice,
      btcDominance,
      totalMarketCap,
      total2MarketCap,
      usdtDominance
    };
  } catch (error) {
    console.error('Errore nel recupero dei dati da CoinGecko:', error);
    throw error;
  }
}; 