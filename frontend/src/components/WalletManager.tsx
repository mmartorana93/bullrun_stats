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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
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

  const handleAddWallet = async () => {
    try {
      const response = await api.post<WalletResponse>('/api/wallets', {
        wallet: newWallet,
      });
      setSuccess(response.data.message || 'Wallet aggiunto con successo');
      setNewWallet('');
      onWalletsUpdate();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante l\'aggiunta del wallet');
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

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Aggiungi Nuovo Wallet
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Inserisci l'indirizzo del wallet Solana"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleAddWallet}
            disabled={!newWallet}
          >
            Aggiungi
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Wallet Monitorati
        </Typography>
        <List>
          {wallets.map((wallet) => (
            <ListItem key={wallet}>
              <ListItemText
                primary={wallet}
                secondary={`Monitoraggio attivo`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleRemoveWallet(wallet)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
        {wallets.length === 0 && (
          <Typography color="text.secondary" align="center">
            Nessun wallet monitorato
          </Typography>
        )}
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WalletManager;
