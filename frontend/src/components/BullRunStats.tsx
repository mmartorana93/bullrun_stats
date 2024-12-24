import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Paper, CircularProgress, Grid, Divider, IconButton, Tooltip } from '@mui/material';
import { getCoinbaseRanking } from '../api/coinbaseService';
import { getBitcoinDominance, BitcoinDominanceData } from '../services/cryptoService';
import coinbaseIcon from '../assets/images/coinbase.png';
import bullrunLogo from '../assets/images/image-5.png';
import { useMarketStore } from '../store/marketStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getGlobalMarketData } from '../services/coingeckoService';
import { motion, AnimatePresence } from 'framer-motion';

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
        p: 3,
        height: '350px',
        mb: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%)',
        borderRadius: '16px',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }
      }}
    >
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontWeight: 600,
          color: '#f0f0f0',
          fontSize: '1.25rem',
          letterSpacing: '0.5px'
        }}
      >
        {title}
      </Typography>
      <Box sx={{ 
        flex: 1,
        minHeight: 0,
        position: 'relative',
        mb: 1,
        borderRadius: '12px',
        overflow: 'hidden'
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
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      height: '100%',
      background: 'linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%)',
      borderRadius: '16px',
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
      }
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box sx={{ 
        width: 48, 
        height: 48, 
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        padding: '8px'
      }}>
        <img 
          src={icon} 
          alt={`${title} Icon`} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </Box>

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#a0a0a0',
              fontWeight: 500,
              fontSize: '0.95rem',
              letterSpacing: '0.5px'
            }}
          >
            {title}
          </Typography>
          {children}
        </Box>
        
        {isLoading ? (
          <CircularProgress size={24} sx={{ color: '#3f51b5' }} />
        ) : error ? (
          <Typography color="error" variant="body2" sx={{ fontWeight: 500 }}>{error}</Typography>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={value}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <Typography 
                  variant="h4" 
                  sx={{ 
                    lineHeight: 1.2,
                    fontWeight: 700,
                    background: 'linear-gradient(45deg, #3f51b5, #2196f3)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '0.5px',
                    mb: 1
                  }}
                >
                  {value || '---'}
                </Typography>
              </motion.div>
            </AnimatePresence>
            {target && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#4caf50',
                  fontWeight: 600,
                  display: 'block',
                  fontSize: '0.85rem',
                  mb: 0.5
                }}
              >
                Target: {target}
              </Typography>
            )}
            {lastUpdate && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#a0a0a0',
                  display: 'block',
                  fontSize: '0.75rem'
                }}
              >
                Ultimo aggiornamento: {lastUpdate}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  </Paper>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const updateMarketData = useCallback(async () => {
    try {
      const data = await getGlobalMarketData();
      updateBtcPrice(data.btcPrice);
      updateBtcDominance(data.btcDominance);
      updateTotal(data.totalMarketCap);
      updateTotal2(data.total2MarketCap);
      updateUsdtDominance(data.usdtDominance);
      updateTotal3(data.totalMarketCap - data.total2MarketCap);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Errore nel recupero dei dati di mercato:', err);
    }
  }, [updateBtcPrice, updateBtcDominance, updateTotal, updateTotal2, updateUsdtDominance, updateTotal3]);

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

  useEffect(() => {
    updateMarketData();
    const interval = setInterval(updateMarketData, 30000); // Aggiorna ogni 30 secondi
    return () => clearInterval(interval);
  }, [updateMarketData]);

  return (
    <Box 
      sx={{ 
        background: 'linear-gradient(135deg, #0a0a0a 0%, #000000 100%)',
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: 0,
        position: 'absolute',
        top: 0,
        left: 0,
        color: '#f0f0f0',
        overflowX: 'hidden'
      }}
    >
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Box 
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 3,
            mt: 1
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src={bullrunLogo} 
              alt="BullRun Logo" 
              style={{
                width: '180px',
                height: 'auto',
                marginBottom: '16px'
              }}
            />
          </motion.div>
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              fontWeight: 800,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              textAlign: 'center',
              background: 'linear-gradient(45deg, #f0f0f0, #ffffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '1px',
              mb: 0.5
            }}
          >
            BullRun Stats
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#a0a0a0',
              textAlign: 'center',
              maxWidth: '600px',
              mb: 1,
              fontSize: '0.9rem'
            }}
          >
            Monitora in tempo reale le metriche chiave del mercato crypto
          </Typography>
          <LastUpdateIndicator />
        </Box>

        {/* Sezione Indicatori */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 1.5, md: 2.5 }, 
            mb: 3, 
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            px: 1
          }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                color: '#f0f0f0',
                letterSpacing: '0.5px',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              Indicatori di Mercato
            </Typography>
            <Tooltip title="Aggiorna dati">
              <IconButton 
                onClick={updateMarketData} 
                sx={{ 
                  background: 'rgba(255,255,255,0.05)',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2}>
            {/* Prima riga di indicatori */}
            <Grid item xs={12} md={3}>
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
            </Grid>
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Dominanza Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={btcDominance ? `${btcDominance.toFixed(2)}%` : undefined}
                target="43.87%"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Prezzo Bitcoin"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={btcPrice ? `$${btcPrice.toLocaleString()}` : undefined}
                target="87K/109K"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Total 2"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total2 ? `$${(total2 / 1e12).toFixed(1)}T` : undefined}
                target="2T/2.5T"
              />
            </Grid>

            {/* Seconda riga di indicatori */}
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Others (Total 3)"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total3 ? `$${(total3 / 1e9).toFixed(0)}B` : undefined}
                target="600B/685B"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="USDT Dominance"
                icon="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                value={usdtDominance ? `${usdtDominance.toFixed(2)}%` : undefined}
                target="3.80%"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Total"
                icon="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                value={total ? `$${(total / 1e12).toFixed(1)}T` : undefined}
                target="4T/4.5T"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Sezione Grafici */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
      </Box>
    </Box>
  );
};

export default BullRunStats;
