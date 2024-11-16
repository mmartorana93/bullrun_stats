import React from 'react';
import { Box, Tabs, Tab, Stack, CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LPTracking from './components/LPTracking';
import BullRunStats from './components/BullRunStats';
import BetaIcon from '@mui/icons-material/NewReleases';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import WalletManager from './components/WalletManager';
import TransactionLog from './components/TransactionLog';
import api from './api/config';
import { WebSocketProvider } from './contexts/WebSocketContext';
import PersistentTabContent from './components/PersistentTabContent';

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [myWallet, setMyWallet] = useState({ address: '', balance: 0, isTestWallet: false });
  const [wallets, setWallets] = useState<string[]>([]);

  useEffect(() => {
    const fetchWalletInfo = async () => {
      try {
        const response = await api.get('/api/wallets/my-wallet');
        setMyWallet(response.data);
      } catch (error) {
        console.error('Errore nel recupero info wallet:', error);
      }
    };

    fetchWalletInfo();
    // Aggiorna il balance ogni 30 secondi
    const interval = setInterval(fetchWalletInfo, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  return (
    <WebSocketProvider>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ 
          minHeight: '100vh',
          bgcolor: 'background.default',
          position: 'relative'
        }}>
          <Header 
            address={myWallet.address} 
            balance={myWallet.balance}
            isTestWallet={myWallet.isTestWallet}
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
                      <span>BullRun Stats</span>
                      <BetaIcon color="warning" fontSize="small" />
                    </Stack>
                  }
                />
              </Tabs>
            </Box>

            <Box sx={{ p: 3, height: 'calc(100% - 64px)' }}>
              <PersistentTabContent value={tabValue} index={0}>
                <WalletManager wallets={wallets} onWalletsUpdate={setWallets} />
              </PersistentTabContent>
              
              <PersistentTabContent value={tabValue} index={1}>
                <TransactionLog />
              </PersistentTabContent>
              
              <PersistentTabContent value={tabValue} index={2}>
                <LPTracking />
              </PersistentTabContent>
              
              <PersistentTabContent value={tabValue} index={3}>
                <BullRunStats />
              </PersistentTabContent>
            </Box>
          </Box>
        </Box>
      </ThemeProvider>
    </WebSocketProvider>
  );
}

export default App;
