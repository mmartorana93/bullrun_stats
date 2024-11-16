import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Grid, Divider, IconButton, Tooltip } from '@mui/material';
import { getCoinbaseRanking } from '../api/coinbaseService';
import { getBitcoinDominance, BitcoinDominanceData } from '../services/cryptoService';
import coinbaseIcon from '../assets/images/coinbase.png';
import { useMarketStore } from '../store/marketStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import RefreshIcon from '@mui/icons-material/Refresh';

interface RankingData {
  ranking: number;
  lastUpdate: string;
}

interface TradingViewWidgetProps {
  symbol: string;
  title: string;
  onPriceUpdate?: (price: number) => void;
}

interface IndicatorItemProps {
  title: string;
  icon: string;
  value?: string;
  target?: string;
  lastUpdate?: string;
  isLoading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, title, onPriceUpdate }) => {
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
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://s3.tradingview.com/tv.css';
        document.head.appendChild(link);
        
        script.async = true;
        script.onload = () => {
          console.log('TradingView script caricato');
          resolve();
        };
        script.onerror = (error) => {
          console.error('Errore nel caricamento dello script TradingView:', error);
        };
        document.head.appendChild(script);
      });
    };

    const initWidget = () => {
      if (!currentContainer || !window.TradingView) return;
      console.log(`Inizializzazione widget per ${symbol}`);

      const widget = new window.TradingView.widget({
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
        height: '280',
        width: '100%',
        autosize: false,
        studies_overrides: {},
        loading_screen: { backgroundColor: "#1e1e1e" },
        debug: true,
        onSymbolLoaded: function() {
          console.log(`[${symbol}] Simbolo caricato`);
          console.log(`[${symbol}] SymbolInfo:`, this.symbolInfo);
          if (this.symbolInfo) {
            const price = this.symbolInfo.last_price;
            console.log(`[${symbol}] Prezzo dal simbolo:`, price);
            if (price && onPriceUpdate) {
              console.log(`[${symbol}] Aggiornamento prezzo nello store:`, price);
              onPriceUpdate(price);
            }
          } else {
            console.warn(`[${symbol}] SymbolInfo non disponibile`);
          }
        },
        onRealtimeCallback: function(data: { last_price?: number }) {
          console.log(`[${symbol}] Aggiornamento in tempo reale:`, data);
          if (data && data.last_price && onPriceUpdate) {
            onPriceUpdate(data.last_price);
          }
        }
      });

      return () => {
        if (currentContainer) {
          currentContainer.innerHTML = '';
        }
      };
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
  }, [symbol, onPriceUpdate]);

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 2, 
        height: '350px',
        mb: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ 
        flex: 1,
        minHeight: 0,
        position: 'relative',
        mb: 1
      }}>
        <div
          ref={container}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </Box>
    </Paper>
  );
};

const formatLastUpdate = (dateString: string) => {
  const date = new Date(dateString);
  return format(date, 'dd/MM/yyyy, HH:mm', { locale: it });
};

const IndicatorItem: React.FC<IndicatorItemProps> = ({
  title,
  icon,
  value,
  target,
  lastUpdate,
  isLoading,
  error,
  children
}) => (
  <Box sx={{ py: 1.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ 
        width: 32, 
        height: 32, 
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {children}
        </Box>
        
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

const LastUpdateIndicator: React.FC = () => {
  const [timeAgo, setTimeAgo] = useState<string>('');
  const lastUpdate = useRef(new Date());

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const diff = now.getTime() - lastUpdate.current.getTime();
      const seconds = Math.floor(diff / 1000);
      
      if (seconds < 60) {
        setTimeAgo(`${seconds}s fa`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m fa`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Typography 
      variant="caption" 
      color="text.secondary"
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 0.5,
        mt: 1
      }}
    >
      <span>Ultimo aggiornamento: {timeAgo}</span>
      {timeAgo && parseInt(timeAgo) > 2 && (
        <CircularProgress size={12} thickness={6} />
      )}
    </Typography>
  );
};

const BullRunStats: React.FC = () => {
  const { 
    updateBtcDominance, 
    updateBtcPrice,
    updateTotal2,
    updateTotal3,
    updateUsdtDominance,
    updateTotal,
    btcDominance,
    btcPrice,
    total2,
    total3,
    usdtDominance,
    total
  } = useMarketStore();

  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [btcDominanceData, setBtcDominanceData] = useState<BitcoinDominanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [btcDominanceLoading, setBtcDominanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [btcDominanceError, setBtcDominanceError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getCoinbaseRanking();
        setRankingData({
          ranking: response.data.ranking,
          lastUpdate: response.data.timestamp
        });
      } catch (err) {
        console.error('Errore nel recupero del ranking Coinbase:', err);
        setError('Errore nel caricamento del ranking');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        BullRun Stats
        <LastUpdateIndicator />
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
              >
                <Tooltip title="Force refresh ranking">
                  <IconButton 
                    size="small" 
                    onClick={async () => {
                      const fetchRanking = async () => {
                        setLoading(true);
                        setError(null);
                        try {
                          const response = await getCoinbaseRanking(true);
                          setRankingData({
                            ranking: response.data.ranking,
                            lastUpdate: response.data.timestamp
                          });
                        } catch (err) {
                          console.error('Errore nel recupero del ranking Coinbase:', err);
                          setError('Errore nel caricamento del ranking');
                        } finally {
                          setLoading(false);
                        }
                      };
                      await fetchRanking();
                    }}
                    disabled={loading}
                    sx={{ 
                      padding: '4px',
                      '& svg': { fontSize: '1rem' }
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </IndicatorItem>
              <Divider />
              <IndicatorItem
                title="Dominanza Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={btcDominance ? `${btcDominance.toFixed(2)}%` : undefined}
                target="43.87%"
              />
              <Divider />
              <IndicatorItem
                title="Prezzo Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={btcPrice ? `$${btcPrice.toLocaleString()}` : undefined}
                target="87K/109K"
              />
              <Divider />
              <IndicatorItem
                title="Total 2"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total2 ? `$${(total2 / 1e12).toFixed(1)}T` : undefined}
                target="2T/2.5T"
              />
              <Divider />
              <IndicatorItem
                title="Others (Total 3)"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total3 ? `$${(total3 / 1e9).toFixed(0)}B` : undefined}
                target="600B/685B"
              />
              <Divider />
              <IndicatorItem
                title="USDT Dominance"
                icon="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                value={usdtDominance ? `${usdtDominance.toFixed(2)}%` : undefined}
                target="3.80%"
              />
              <Divider />
              <IndicatorItem
                title="Total"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total ? `$${(total / 1e12).toFixed(1)}T` : undefined}
                target="4T/4.5T"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Colonna destra per i grafici */}
        <Grid item xs={12} md={9}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TradingViewWidget 
              symbol="BTC.D"
              title="Bitcoin Dominance"
              onPriceUpdate={updateBtcDominance}
            />
            <TradingViewWidget 
              symbol="BINANCE:BTCUSDT"
              title="Prezzo Bitcoin"
              onPriceUpdate={updateBtcPrice}
            />
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL2"
              title="Total 2"
              onPriceUpdate={updateTotal2}
            />
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL3"
              title="Others (Total 3)"
              onPriceUpdate={updateTotal3}
            />
            <TradingViewWidget 
              symbol="USDT.D"
              title="USDT Dominance"
              onPriceUpdate={updateUsdtDominance}
            />
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL"
              title="Total"
              onPriceUpdate={updateTotal}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BullRunStats;
