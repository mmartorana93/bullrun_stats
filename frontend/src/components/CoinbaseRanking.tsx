import React, { useEffect, useState } from 'react';
import { getCoinbaseRanking } from '../api/coinbaseService';
import { IconButton, Tooltip, Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

const CoinbaseRanking: React.FC = () => {
  const [ranking, setRanking] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async (force: boolean = false) => {
    try {
      setLoading(true);
      const data = await getCoinbaseRanking(force);
      setRanking(data.ranking);
    } catch (err) {
      setError('Failed to fetch Coinbase ranking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, []);

  if (error) return <div>{error}</div>;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <h3 style={{ margin: 0 }}>Coinbase App Ranking</h3>
      <Tooltip title="Force refresh ranking">
        <IconButton 
          size="small" 
          onClick={() => fetchRanking(true)}
          disabled={loading}
          sx={{ 
            padding: '4px',
            '& svg': { fontSize: '1rem' }
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      {ranking && <p style={{ margin: 0 }}>#{ranking}</p>}
      {loading && <span>...</span>}
    </Box>
  );
};

export default CoinbaseRanking; 