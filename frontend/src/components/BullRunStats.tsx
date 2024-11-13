import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Grid } from '@mui/material';
import { getCoinbaseRanking } from '../api/config';
import { getBitcoinDominance, BitcoinDominanceData } from '../services/cryptoService';
import coinbaseIcon from '../assets/images/coinbase.png';

interface RankingData {
  ranking: number;
  lastUpdate: string;
}

interface TradingViewWidgetProps {
  symbol: string;
  title: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = `
        {
          "autosize": true,
          "symbol": "${symbol}",
          "interval": "D",
          "timezone": "Europe/Rome",
          "theme": "dark",
          "style": "1",
          "locale": "it",
          "enable_publishing": false,
          "hide_top_toolbar": true,
          "allow_symbol_change": false,
          "save_image": false,
          "calendar": false,
          "hide_volume": true,
          "support_host": "https://www.tradingview.com"
        }`;
      containerRef.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <Paper elevation={3} sx={{ p: 2, height: '400px', mb: 2 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ height: 'calc(100% - 32px)' }}>
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: '100%', width: '100%' }}
        >
          <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }}></div>
        </div>
      </Box>
    </Paper>
  );
};

const BullRunStats: React.FC = () => {
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [btcDominanceData, setBtcDominanceData] = useState<BitcoinDominanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [btcDominanceLoading, setBtcDominanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [btcDominanceError, setBtcDominanceError] = useState<string | null>(null);

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

    const fetchBtcDominance = async () => {
      try {
        setBtcDominanceLoading(true);
        const data = await getBitcoinDominance();
        if (data && typeof data.btcDominance === 'number') {
          setBtcDominanceData(data);
          setBtcDominanceError(null);
        } else {
          throw new Error('Dati dominanza Bitcoin non validi');
        }
      } catch (err) {
        console.error('Error fetching BTC dominance:', err);
        setBtcDominanceError('Errore nel caricamento della dominanza BTC');
      } finally {
        setBtcDominanceLoading(false);
      }
    };

    fetchRanking();
    fetchBtcDominance();

    // Aggiorna ogni 5 minuti
    const rankingInterval = setInterval(fetchRanking, 5 * 60 * 1000);
    const btcDominanceInterval = setInterval(fetchBtcDominance, 5 * 60 * 1000);

    return () => {
      clearInterval(rankingInterval);
      clearInterval(btcDominanceInterval);
    };
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

  const IndicatorCard = ({ 
    title, 
    icon, 
    value, 
    target,
    lastUpdate, 
    isLoading, 
    error 
  }: {
    title: string;
    icon: string;
    value?: string | number;
    target?: string;
    lastUpdate?: string;
    isLoading?: boolean;
    error?: string | null;
  }) => (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3,
        mb: 2,
        width: '100%'
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
            src={icon} 
            alt={`${title} Icon`} 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          
          {isLoading ? (
            <CircularProgress size={24} />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              <Typography variant="h4" gutterBottom>
                {value || '---'}
              </Typography>
              {target && (
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Target: {target}
                </Typography>
              )}
              {lastUpdate && (
                <Typography variant="caption" color="text.secondary">
                  Ultimo aggiornamento: {lastUpdate}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        BullRun Stats
      </Typography>

      <Grid container spacing={3}>
        {/* Colonna sinistra per gli indicatori */}
        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <IndicatorCard
              title="Ranking Coinbase App Store"
              icon={coinbaseIcon}
              value={rankingData?.ranking ? `#${rankingData.ranking}` : undefined}
              lastUpdate={rankingData?.lastUpdate ? formatLastUpdate(rankingData.lastUpdate) : undefined}
              isLoading={loading}
              error={error}
            />
            <IndicatorCard
              title="Dominanza Bitcoin"
              icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
              value={btcDominanceData?.btcDominance ? `${btcDominanceData.btcDominance.toFixed(2)}%` : undefined}
              target="43.87%"
              lastUpdate={btcDominanceData?.lastUpdate ? formatLastUpdate(btcDominanceData.lastUpdate) : undefined}
              isLoading={btcDominanceLoading}
              error={btcDominanceError}
            />
            <IndicatorCard
              title="Prezzo Bitcoin"
              icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
              value="$36,500"
              target="87K/109K"
            />
            <IndicatorCard
              title="Total 2"
              icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
              value="1.8T"
              target="2T/2.5T"
            />
            <IndicatorCard
              title="Others (Total 3)"
              icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
              value="550B"
              target="600B/685B"
            />
            <IndicatorCard
              title="USDT Dominance"
              icon="https://assets.coingecko.com/coins/images/325/small/Tether.png"
              value="3.50%"
              target="3.80%"
            />
            <IndicatorCard
              title="Total"
              icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
              value="3.5T"
              target="4T/4.5T"
            />
          </Box>
        </Grid>

        {/* Colonna destra per i grafici */}
        <Grid item xs={12} md={9}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TradingViewWidget 
              symbol="BINANCE:BTCUSDT" 
              title="Prezzo Bitcoin"
            />
            <TradingViewWidget 
              symbol="TOTAL2" 
              title="Total 2"
            />
            <TradingViewWidget 
              symbol="TOTAL3" 
              title="Others (Total 3)"
            />
            <TradingViewWidget 
              symbol="CRYPTOCAP:BTC.D" 
              title="Bitcoin Dominance"
            />
            <TradingViewWidget 
              symbol="CRYPTOCAP:USDT.D" 
              title="USDT Dominance"
            />
            <TradingViewWidget 
              symbol="TOTAL" 
              title="Total"
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BullRunStats;
