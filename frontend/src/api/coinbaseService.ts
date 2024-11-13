import axios from 'axios';

export const getCoinbaseRanking = async (force: boolean = false) => {
  const response = await axios.get(`/api/coinbase-ranking?force=${force}`);
  return response.data;
}; 