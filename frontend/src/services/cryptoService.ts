import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export interface BitcoinDominanceData {
  btcDominance: number;
  lastUpdate: string;
}

export const getBitcoinDominance = async (): Promise<BitcoinDominanceData> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/bitcoin-dominance`);
    
    // Validazione della risposta
    if (!response.data || typeof response.data.btcDominance !== 'number') {
      console.error('Risposta API non valida:', response.data);
      throw new Error('Risposta API non valida');
    }

    return {
      btcDominance: response.data.btcDominance,
      lastUpdate: response.data.lastUpdate
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Errore nella chiamata API:', error.response?.data || error.message);
    } else {
      console.error('Errore nel recupero della dominanza Bitcoin:', error);
    }
    throw error;
  }
};
