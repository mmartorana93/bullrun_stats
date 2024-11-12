import React from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, Tabs, Tab, Stack } from '@mui/material';
import WalletManager from './components/WalletManager';
import TransactionLog from './components/TransactionLog';
import TokenRanking from './components/TokenRanking';
import LPTracking from './components/LPTracking';
import Analytics from './components/Analytics';
import BullRunStats from './components/BullRunStats';
import BetaIcon from '@mui/icons-material/NewReleases';
import { useState, useEffect } from 'react';
import { Transaction } from './types';
import api from './api/config';
import Header from './components/Header';
import { WebSocketProvider } from './contexts/WebSocketContext';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      style={{ padding: '20px 0' }}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function App() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myWallet, setMyWallet] = useState({ address: '', balance: 0 });
  const [solanaPrice, setSolanaPrice] = useState<number | null>(null);
  const [tabValue, setTabValue] = useState(1);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const fetchWallets = async () => {
    try {
      const response = await api.get('/api/wallets');
      setWallets(response.data);
    } catch (error) {
      console.error('Error fetching wallets:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const walletsResponse = await api.get('/api/wallets');
      if (!walletsResponse.data.length) {
        setTransactions([]);
        return;
      }
      
      const response = await api.get('/api/logs');
      setTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchMyWalletInfo = async () => {
    try {
      const response = await api.get('/api/my-wallet');
      setMyWallet(response.data);
    } catch (error) {
      console.error('Error fetching personal wallet info:', error);
    }
  };

  const fetchSolanaPrice = async () => {
    try {
      const { data } = await api.get('/api/solana-price');
      if (data && typeof data.price === 'number' && data.price > 0) {
        setSolanaPrice(data.price);
      }
    } catch (error) {
      console.error('Error fetching Solana price:', error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchSolanaPrice();
      await fetchWallets();
      await fetchTransactions();
      await fetchMyWalletInfo();
    };

    fetchInitialData();
    
    const priceInterval = setInterval(fetchSolanaPrice, 30000);
    const dataInterval = setInterval(() => {
      fetchWallets();
      fetchTransactions();
      fetchMyWalletInfo();
    }, 30000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(dataInterval);
    };
  }, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WebSocketProvider>
        <Box sx={{ 
          minHeight: '100vh',
          bgcolor: 'background.default',
          position: 'relative'
        }}>
          <Header 
            address={myWallet.address} 
            balance={myWallet.balance} 
            solPrice={solanaPrice}
          />
          
          <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                centered
                sx={{
                  '& .MuiTab-root': {
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    py: 2
                  }
                }}
              >
                <Tab label="Gestione Wallet" />
                <Tab label="Log Transazioni" />
                <Tab label="Token Ranking" />
                <Tab 
                  icon={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>LP Tracking</span>
                      <BetaIcon color="warning" fontSize="small" />
                    </Stack>
                  }
                />
                <Tab 
                  icon={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>Analytics</span>
                      <BetaIcon color="warning" fontSize="small" />
                    </Stack>
                  }
                />
                <Tab 
                  icon={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>BullRun Stats</span>
                      <BetaIcon color="warning" fontSize="small" />
                    </Stack>
                  }
                />
              </Tabs>
            </Box>

            <Box sx={{ p: 3 }}>
              <TabPanel value={tabValue} index={0}>
                <WalletManager
                  wallets={wallets}
                  onWalletsUpdate={fetchWallets}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <TransactionLog transactions={transactions} />
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                <TokenRanking />
              </TabPanel>
              <TabPanel value={tabValue} index={3}>
                <LPTracking />
              </TabPanel>
              <TabPanel value={tabValue} index={4}>
                <Analytics />
              </TabPanel>
              <TabPanel value={tabValue} index={5}>
                <BullRunStats />
              </TabPanel>
            </Box>
          </Box>
        </Box>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;
