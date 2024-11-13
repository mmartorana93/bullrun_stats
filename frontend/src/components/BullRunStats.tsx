import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Grid, Divider } from '@mui/material';
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

declare global {
  interface Window {
    TradingView?: any;
  }
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, title }) => {
  const container = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    const currentContainer = container.current;
    
    const loadTradingViewScript = () => {
      return new Promise<void>((resolve) => {
        if (window.TradingView) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.id = 'tradingview-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    const initWidget = () => {
      if (!currentContainer || !window.TradingView) return;

      new window.TradingView.widget({
        container_id: currentContainer.id,
        symbol: symbol,
        interval: 'D',
        timezone: 'Europe/Rome',
        theme: 'dark',
        style: '1',
        locale: 'it',
        enable_publishing: false,
        hide_top_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        hide_volume: true,
        height: '100%',
        width: '100%',
      });
    };

    const init = async () => {
      if (!scriptLoaded.current) {
        await loadTradingViewScript();
        scriptLoaded.current = true;
      }
      initWidget();
    };

    if (currentContainer) {
      currentContainer.innerHTML = '';
      currentContainer.id = `tradingview-widget-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;
      init();
    }

    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <Paper elevation={3} sx={{ p: 2, height: '400px', mb: 2 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ height: 'calc(100% - 32px)' }}>
        <div
          ref={container}
          style={{ height: '100%', width: '100%' }}
        />
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

  const IndicatorItem = ({ 
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
    <Box sx={{ py: 1.5 }}>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <Box 
          sx={{ 
            width: 32, 
            height: 32, 
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
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          
          {isLoading ? (
            <CircularProgress size={20} />
          ) : error ? (
            <Typography color="error" variant="body2">{error}</Typography>
          ) : (
            <>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {value || '---'}
              </Typography>
              {target && (
                <Typography variant="caption" color="primary">
                  Target: {target}
                </Typography>
              )}
              {lastUpdate && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Ultimo aggiornamento: {lastUpdate}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        BullRun Stats
      </Typography>

      <Grid container spacing={3}>
        {/* Colonna sinistra per gli indicatori */}
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Indicatori
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <IndicatorItem
                title="Ranking Coinbase App Store"
                icon={coinbaseIcon}
                value={rankingData?.ranking ? `#${rankingData.ranking}` : undefined}
                lastUpdate={rankingData?.lastUpdate ? formatLastUpdate(rankingData.lastUpdate) : undefined}
                isLoading={loading}
                error={error}
              />
              <Divider />
              <IndicatorItem
                title="Dominanza Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={btcDominanceData?.btcDominance ? `${btcDominanceData.btcDominance.toFixed(2)}%` : undefined}
                target="43.87%"
                lastUpdate={btcDominanceData?.lastUpdate ? formatLastUpdate(btcDominanceData.lastUpdate) : undefined}
                isLoading={btcDominanceLoading}
                error={btcDominanceError}
              />
              <Divider />
              <IndicatorItem
                title="Prezzo Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value="$36,500"
                target="87K/109K"
              />
              <Divider />
              <IndicatorItem
                title="Total 2"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value="1.8T"
                target="2T/2.5T"
              />
              <Divider />
              <IndicatorItem
                title="Others (Total 3)"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value="550B"
                target="600B/685B"
              />
              <Divider />
              <IndicatorItem
                title="USDT Dominance"
                icon="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                value="3.50%"
                target="3.80%"
              />
              <Divider />
              <IndicatorItem
                title="Total"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value="3.5T"
                target="4T/4.5T"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Colonna destra per i grafici */}
        <Grid item xs={12} md={9}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TradingViewWidget 
              symbol="CRYPTOCAP:BTC.D" 
              title="Bitcoin Dominance"
            />
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
