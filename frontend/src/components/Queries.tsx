import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  List, 
  ListItem, 
  ListItemText,
  ListItemButton,
  TextField,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import axios from 'axios';
import api from '../api/config';

// Definizione delle query disponibili
const AVAILABLE_QUERIES = [
  {
    id: 'snipers',
    name: 'Token Snipers',
    description: 'Trova i wallet che hanno snipato un token specifico',
    queryId: 3893581,
    params: [
      {
        name: 'token_address',
        type: 'string',
        description: 'Indirizzo del token',
        required: true
      }
    ]
  },
  {
    id: 'top_performers',
    name: 'Top Performers',
    description: 'Identifica i wallet con le migliori performance su un token',
    queryId: 3945025,
    params: [
      {
        name: 'token_address',
        type: 'string',
        description: 'Indirizzo del token',
        required: true
      }
    ]
  },
  {
    id: 'top_traders',
    name: 'Top Traders',
    description: 'Trova i trader più profittevoli su un token specifico (win rate > 70%)',
    queryId: 3873134,
    params: [
      {
        name: 'token_address',
        type: 'string',
        description: 'Indirizzo del token',
        required: true
      }
    ]
  },
  {
    id: 'wallet_fetcher',
    name: 'Wallet Fetcher',
    description: 'Recupera i wallet che hanno interagito con un token da un timestamp specifico',
    queryId: 3932084,
    params: [
      {
        name: 'token',
        type: 'string',
        description: 'Indirizzo del token',
        required: true
      },
      {
        name: 'time',
        type: 'string',
        description: 'Timestamp (YYYY-MM-DD HH:MM:SS)',
        required: true
      }
    ]
  }
];

const Queries: React.FC = () => {
  const [selectedQuery, setSelectedQuery] = useState(AVAILABLE_QUERIES[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  const handleParamChange = (name: string, value: string) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleExecuteQuery = async () => {
    // Validazione parametri
    const missingParams = selectedQuery.params.filter(
      param => param.required && !params[param.name]
    );

    if (missingParams.length > 0) {
      setError(`Parametri mancanti: ${missingParams.map(p => p.name).join(', ')}`);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`/api/dune/execute`, {
        queryId: selectedQuery.queryId,
        params
      });
      setResults(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'esecuzione della query');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Grid container spacing={2} sx={{ height: 'calc(100vh - 100px)' }}>
      {/* Menu delle queries */}
      <Grid item xs={3}>
        <Paper sx={{ height: '100%', overflow: 'auto' }}>
          <List>
            {AVAILABLE_QUERIES.map((query) => (
              <ListItem
                key={query.id}
                disablePadding
                divider
              >
                <ListItemButton
                  selected={selectedQuery.id === query.id}
                  onClick={() => {
                    setSelectedQuery(query);
                    setParams({});
                    setResults(null);
                    setError(null);
                  }}
                >
                  <ListItemText
                    primary={query.name}
                    secondary={query.description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>

      {/* Area dettagli e risultati */}
      <Grid item xs={9}>
        <Paper sx={{ height: '100%', overflow: 'auto', p: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              {selectedQuery.name}
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              {selectedQuery.description}
            </Typography>
          </Box>

          {/* Form parametri */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
              Parametri
            </Typography>
            <Grid container spacing={2}>
              {selectedQuery.params.map((param) => (
                <Grid item xs={12} sm={6} key={param.name}>
                  <TextField
                    fullWidth
                    label={param.name}
                    helperText={param.description}
                    value={params[param.name] || ''}
                    onChange={(e) => handleParamChange(param.name, e.target.value)}
                    required={param.required}
                    size="small"
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Button
              variant="contained"
              onClick={handleExecuteQuery}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
            >
              Esegui Query
            </Button>
          </Box>

          {/* Area risultati */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {results && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Risultati
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  maxHeight: 400, 
                  overflow: 'auto',
                  bgcolor: 'grey.900'
                }}
              >
                <pre style={{ margin: 0, color: 'white' }}>
                  {JSON.stringify(results, null, 2)}
                </pre>
              </Paper>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Queries; 