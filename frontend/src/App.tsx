import React from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import WalletManager from './components/WalletManager';
import TransactionLog from './components/TransactionLog';
import { useState, useEffect } from 'react';
import { Transaction } from './types';
import api from './api/config';
import Header from './components/Header';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myWallet, setMyWallet] = useState({ address: '', balance: 0 });

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
      
      const response = await api.get('/api/logs');  // Modificato da /api/transactions a /api/logs
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
        <Box sx={{ p: 3 }}>
          <WalletManager
            wallets={wallets}
            onWalletsUpdate={fetchWallets}
          />
          <Box sx={{ mt: 2 }}>
            <TransactionLog transactions={transactions} />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
