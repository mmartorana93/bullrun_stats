import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Typography,
  Alert,
  Snackbar,
  Tooltip,
  Chip,
  Divider,
  Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import { WalletResponse } from '../types';
import api from '../api/config';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useRealTimeStore } from '../store/realTimeStore';

interface WalletManagerProps {
  wallets: string[];
  onWalletsUpdate: (wallets: string[]) => void;
}

interface WalletData {
  balance: number;
  lastTransaction?: {
    signature: string;
    timestamp: number;
    amount: number;
    type: 'credit' | 'debit';
  };
}

const WalletManager: React.FC<WalletManagerProps> = ({ wallets, onWalletsUpdate }) => {
  const [newWallet, setNewWallet] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [walletData, setWalletData] = useState<Record<string, WalletData>>({});
  const { socket, isConnected } = useWebSocket();
  const { walletStatuses, updateWalletsStatus } = useRealTimeStore();

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const response = await api.get('/api/wallets');
        onWalletsUpdate(response.data);
      } catch (error: any) {
        setError(error.response?.data?.error || 'Errore durante il caricamento dei wallet');
      }
    };

    fetchWallets();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleWalletUpdate = (data: {
      wallet: string;
      type: 'balance' | 'transaction';
      balance?: number;
      transaction?: {
        signature: string;
        timestamp: number;
        amount: number;
        type: 'credit' | 'debit';
      };
    }) => {
      setWalletData(prev => {
        if (!wallets.includes(data.wallet)) return prev;
        
        const current = prev[data.wallet] || { balance: 0 };
        
        if (data.type === 'balance' && typeof data.balance === 'number') {
          return {
            ...prev,
            [data.wallet]: {
              ...current,
              balance: data.balance
            }
          };
        }
        
        if (data.type === 'transaction' && data.transaction) {
          return {
            ...prev,
            [data.wallet]: {
              ...current,
              lastTransaction: data.transaction
            }
          };
        }
        
        return prev;
      });
    };

    socket.on('walletUpdate', handleWalletUpdate);

    return () => {
      socket.off('walletUpdate', handleWalletUpdate);
    };
  }, [socket, wallets]);

  useEffect(() => {
    if (!socket) return;

    socket.on('walletsStatus', ({ wallets, status }) => {
      updateWalletsStatus(wallets, status === 'connected');
    });

    return () => {
      socket.off('walletsStatus');
    };
  }, [socket, updateWalletsStatus]);

  const validateSolanaAddress = (address: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleAddWallet = async () => {
    if (!validateSolanaAddress(newWallet)) {
      setError('Indirizzo Solana non valido');
      return;
    }

    if (wallets.includes(newWallet)) {
      setError('Questo wallet è già monitorato');
      return;
    }

    setIsValidating(true);
    try {
      const response = await api.post<WalletResponse>('/api/wallets', {
        wallet: newWallet,
      });
      
      const updatedWallets = [...wallets, newWallet];
      onWalletsUpdate(updatedWallets);
      
      setSuccess(response.data.message || 'Wallet aggiunto con successo');
      setNewWallet('');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante l\'aggiunta del wallet');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    try {
      await api.delete<WalletResponse>(`/api/wallets/${wallet}`);
      
      const updatedWallets = wallets.filter(w => w !== wallet);
      onWalletsUpdate(updatedWallets);
      
      setSuccess('Wallet rimosso con successo');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante la rimozione del wallet');
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess('Indirizzo copiato negli appunti');
  };

  const formatBalance = (balance: number) => {
    return balance.toFixed(4);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderLastTransaction = (wallet: string) => {
    const data = walletData[wallet];
    if (!data?.lastTransaction) return null;

    const { timestamp, type, amount } = data.lastTransaction;
    return (
      <Typography variant="body2" color="text.secondary">
        Ultima Transazione: {formatTimestamp(timestamp)}
        ({type === 'credit' ? '+' : '-'}
        {formatBalance(Math.abs(amount) / 10**9)} SOL)
      </Typography>
    );
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Aggiungi Nuovo Wallet
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                variant="outlined"
                label="Indirizzo Wallet Solana"
                placeholder="Inserisci l'indirizzo del wallet da monitorare"
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                error={newWallet !== '' && !validateSolanaAddress(newWallet)}
                helperText={newWallet !== '' && !validateSolanaAddress(newWallet) ? 
                  'Inserisci un indirizzo Solana valido' : ''}
                size="small"
              />
              <Button
                variant="contained"
                onClick={handleAddWallet}
                disabled={!newWallet || isValidating || !validateSolanaAddress(newWallet)}
                startIcon={<AddIcon />}
                sx={{ minWidth: '120px', height: '40px' }}
              >
                Aggiungi
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Wallet Monitorati ({wallets.length})
            </Typography>
            <List>
              {wallets.map((wallet, index) => (
                <React.Fragment key={wallet}>
                  <ListItem sx={{ 
                    py: 2,
                    backgroundColor: 'background.default',
                    borderRadius: 1,
                    my: 1 
                  }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            sx={{ 
                              fontFamily: 'monospace',
                              fontSize: '0.9rem'
                            }}
                          >
                            {wallet}
                          </Typography>
                          <Chip 
                            label={walletStatuses[wallet] ? "Connesso" : "Disconnesso"} 
                            size="small" 
                            color={walletStatuses[wallet] ? "success" : "error"}
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Saldo: {formatBalance(walletData[wallet]?.balance || 0)} SOL
                          </Typography>
                          {renderLastTransaction(wallet)}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Copia indirizzo">
                        <IconButton
                          edge="end"
                          onClick={() => handleCopyAddress(wallet)}
                          sx={{ mr: 1 }}
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rimuovi wallet">
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveWallet(wallet)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < wallets.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            {wallets.length === 0 && (
              <Box sx={{ 
                p: 3, 
                textAlign: 'center',
                backgroundColor: 'background.default',
                borderRadius: 1
              }}>
                <Typography color="text.secondary">
                  Nessun wallet monitorato. Aggiungi un wallet per iniziare il monitoraggio.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)} variant="filled">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)} variant="filled">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WalletManager;
