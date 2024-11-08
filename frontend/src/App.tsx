import React from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, Tabs, Tab } from '@mui/material';
import WalletManager from './components/WalletManager';
import TransactionLog from './components/TransactionLog';
import { useState, useEffect } from 'react';
import { Transaction } from './types';
import api from './api/config';
import Header from './components/Header';

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
  const [tabValue, setTabValue] = useState(1); // Impostiamo la tab delle transazioni come default

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

  useEffect(() => {
    fetchWallets();
    fetchTransactions();
    fetchMyWalletInfo();
    
    const intervalId = window.setInterval(() => {
      fetchTransactions();
      fetchMyWalletInfo();
    }, 30000);
    
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        position: 'relative'
      }}>
        <Header address={myWallet.address} balance={myWallet.balance} />
        
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
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
