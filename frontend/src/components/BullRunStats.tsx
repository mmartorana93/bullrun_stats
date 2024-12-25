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
        background: 'linear-gradient(145deg, #1e1e1e 0%, #141414 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.03)',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)'
        }
      }}
    >
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          fontSize: '1.25rem',
          letterSpacing: '0.5px',
          background: 'linear-gradient(45deg, #f0f0f0, #bdbdbd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
          mb: 2,
          position: 'relative',
          '&:after': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: 0,
            width: '40px',
            height: '2px',
            background: 'linear-gradient(90deg, #5c6bc0, transparent)',
            borderRadius: '2px'
          }
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
      minHeight: '180px',
      background: 'linear-gradient(145deg, #242424 0%, #1a1a1a 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.1)',
      transform: 'perspective(1000px) translateZ(0)',
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'perspective(1000px) translateZ(10px) translateY(-2px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(145deg, #282828 0%, #1e1e1e 100%)'
      },
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      gap: 2,
      height: '40px',
      mb: 2
    }}>
      <Box sx={{ 
        width: 40, 
        height: 40, 
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'transparent'
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

      <Box sx={{ 
        flex: 1, 
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          width: '100%'
        }}>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 600,
              fontSize: '0.9rem',
              letterSpacing: '0.5px',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              background: 'linear-gradient(45deg, #f0f0f0, #bdbdbd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2
            }}
          >
            {title}
          </Typography>
          {children}
        </Box>
      </Box>
    </Box>

    <Box sx={{ 
      mt: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5
    }}>
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
                  background: 'linear-gradient(45deg, #4B96FF, #6FB1FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.5px',
                  mb: 1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  fontSize: { xs: '1.75rem', md: '2rem' }
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
                color: '#66bb6a',
                fontWeight: 600,
                display: 'block',
                fontSize: '0.85rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              Target: {target}
            </Typography>
          )}
          {lastUpdate && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#9e9e9e',
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

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        background: scrolled 
          ? 'rgba(28, 28, 35, 0.95)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled 
          ? '1px solid rgba(255,255,255,0.1)'
          : 'none',
        boxShadow: scrolled 
          ? '0 4px 30px rgba(0, 0, 0, 0.1)'
          : 'none',
      }}
    >
      <Box
        sx={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.5px',
            }}
          >
            BullRun Stats
          </Typography>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 3,
          '& > *': {
            color: '#f0f0f0',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'color 0.2s ease',
            '&:hover': {
              color: '#4B96FF'
            }
          }
        }}>
          <Typography component="a" href="#" sx={{ opacity: 1 }}>
            Dashboard
          </Typography>
          <Typography component="a" href="#" sx={{ opacity: 0.7 }}>
            Analytics
          </Typography>
          <Typography component="a" href="#" sx={{ opacity: 0.7 }}>
            Reports
          </Typography>
          <Box
            sx={{
              ml: 2,
              px: 2,
              py: 1,
              borderRadius: '8px',
              background: 'rgba(75, 150, 255, 0.1)',
              border: '1px solid rgba(75, 150, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#4caf50',
                animation: 'pulse 2s infinite'
              }}
            />
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: '#4B96FF',
                fontWeight: 600
              }}
            >
              Market Live
            </Typography>
            <LastUpdateIndicator />
          </Box>
        </Box>
      </Box>
    </Box>
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
        background: '#1a1a1a',
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: 0,
        position: 'relative',
        color: '#f0f0f0',
        overflowX: 'hidden',
        pt: '80px'
      }}
    >
      <Header />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          </Box>
        </Box>

        {/* Sezione Indicatori */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 1.5, md: 2.5 }, 
            mb: 3, 
            background: '#1a1a1a'
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
                  background: 'rgba(255,255,255,0.07)',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.12)'
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2} sx={{ width: '100%', m: 0, p: 0 }}>
            {/* Prima riga di indicatori */}
            <Grid item xs={12} md={3}>
              <IndicatorItem
                title="Ranking Coinbase"
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
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="BTC.D"
              title="Bitcoin Dominance"
              onPriceUpdate={updateBtcDominance}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="BINANCE:BTCUSDT"
              title="Prezzo Bitcoin"
              onPriceUpdate={updateBtcPrice}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL2"
              title="Total 2"
              onPriceUpdate={updateTotal2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL3"
              title="Others (Total 3)"
              onPriceUpdate={updateTotal3}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="USDT.D"
              title="USDT Dominance"
              onPriceUpdate={updateUsdtDominance}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TradingViewWidget 
              symbol="CRYPTOCAP:TOTAL"
              title="Total"
              onPriceUpdate={updateTotal}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default BullRunStats;
