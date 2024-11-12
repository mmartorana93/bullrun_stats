import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { getCoinbaseRanking } from '../api/config';
import coinbaseIcon from '../assets/images/coinbase.png';

interface RankingData {
  ranking: number;
  lastUpdate: string;
}

const BullRunStats: React.FC = () => {
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const response = await getCoinbaseRanking();
        setRankingData(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching Coinbase ranking:', err);
        setError('Errore nel caricamento del ranking Coinbase');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
    // Aggiorna ogni 5 minuti
    const interval = setInterval(fetchRanking, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        BullRun Stats
      </Typography>
      
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mt: 2,
          maxWidth: 400,
          mx: 'auto'
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box 
            sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img 
              src={coinbaseIcon} 
              alt="Coinbase Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Ranking Coinbase App Store
            </Typography>
            
            {loading ? (
              <CircularProgress size={24} />
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : (
              <>
                <Typography variant="h4" gutterBottom>
                  #{rankingData?.ranking || '---'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ultimo aggiornamento: {rankingData?.lastUpdate ? formatLastUpdate(rankingData.lastUpdate) : '---'}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default BullRunStats;
