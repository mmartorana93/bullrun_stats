import api from './config';

export const getCoinbaseRanking = async (force: boolean = false) => {
  const response = await api.get('/api/crypto/coinbase-ranking', {
    params: { force }
  });
  return response.data;
}; 