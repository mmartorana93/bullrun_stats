import api from './config';
import CacheService from '../services/cacheService';

export const getCoinbaseRanking = async (force: boolean = false): Promise<any> => {
  try {
    if (!force) {
      const cachedData = CacheService.get('coinbase-ranking');
      if (cachedData) {
        return cachedData;
      }
    }

    const response = await api.get('/api/crypto/coinbase-ranking', {
      params: { force }
    });

    CacheService.set('coinbase-ranking', response.data);
    return response.data;
  } catch (error) {
    const cachedData = CacheService.get('coinbase-ranking');
    if (cachedData) {
      console.warn('Usando ranking Coinbase in cache dopo errore API');
      return cachedData;
    }
    throw error;
  }
};
