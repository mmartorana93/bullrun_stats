import React, { useState } from 'react';
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

interface WalletManagerProps {
  wallets: string[];
  onWalletsUpdate: () => void;
}

const WalletManager: React.FC<WalletManagerProps> = ({ wallets, onWalletsUpdate }) => {
  const [newWallet, setNewWallet] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateSolanaAddress = (address: string): boolean => {
    // Validazione base di un indirizzo Solana (44 caratteri, inizia con una lettera o un numero)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleAddWallet = async () => {
    if (!validateSolanaAddress(newWallet)) {
      setError('Indirizzo Solana non valido');
      return;
    }

    setIsValidating(true);
    try {
      const response = await api.post<WalletResponse>('/api/wallets', {
        wallet: newWallet,
      });
      setSuccess(response.data.message || 'Wallet aggiunto con successo');
      setNewWallet('');
      onWalletsUpdate();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante l\'aggiunta del wallet');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    try {
      const response = await api.delete<WalletResponse>(`/api/wallets/${wallet}`);
      setSuccess(response.data.message || 'Wallet rimosso con successo');
      onWalletsUpdate();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante la rimozione del wallet');
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess('Indirizzo copiato negli appunti');
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
                            label="Attivo" 
                            size="small" 
                            color="success"
                            sx={{ ml: 1 }}
                          />
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
