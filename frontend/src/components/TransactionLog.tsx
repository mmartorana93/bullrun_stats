import React, { useState, useMemo, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Box,
  Chip,
  Link,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import { Transaction } from '../types';
import LoggingService from '../services/loggingService';

interface TransactionLogProps {
  transactions: Transaction[];
}

const TransactionLog: React.FC<TransactionLogProps> = ({ transactions }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchWallet, setSearchWallet] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    // Log new transactions when they arrive
    const logNewTransactions = async () => {
      for (const transaction of transactions) {
        await LoggingService.logTransaction({
          timestamp: transaction.timestamp,
          wallet: transaction.wallet,
          type: transaction.type,
          amount_sol: transaction.amount_sol,
          success: transaction.success,
          signature: transaction.signature
        });
      }
    };

    logNewTransactions();
  }, [transactions]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter(transaction => {
        const matchesWallet = transaction.wallet.toLowerCase().includes(searchWallet.toLowerCase());
        const matchesType = filterType === 'all' || transaction.type === filterType;
        const matchesStatus = filterStatus === 'all' || 
          (filterStatus === 'success' && transaction.success) ||
          (filterStatus === 'failed' && !transaction.success);
        return matchesWallet && matchesType && matchesStatus;
      });
  }, [transactions, searchWallet, filterType, filterStatus]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Log delle Transazioni
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Cerca Wallet"
            variant="outlined"
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            size="small"
          />
        </Grid>
        <Grid item xs={6} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Tipo Transazione</InputLabel>
            <Select
              value={filterType}
              label="Tipo Transazione"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">Tutti</MenuItem>
              <MenuItem value="receive">Ricevute</MenuItem>
              <MenuItem value="send">Inviate</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">Tutti</MenuItem>
              <MenuItem value="success">Successo</MenuItem>
              <MenuItem value="failed">Fallite</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 400px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Wallet</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Importo (SOL)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Signature</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTransactions
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((transaction) => (
                <TableRow key={transaction.signature} hover>
                  <TableCell>
                    {new Date(transaction.timestamp).toLocaleString('it-IT')}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ 
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}>
                      {transaction.wallet}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.type === 'receive' ? 'Ricevuta' : 'Inviata'}
                      color={transaction.type === 'receive' ? 'success' : 'info'}
                      size="small"
                      sx={{ minWidth: 80 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontFamily: 'monospace',
                        color: transaction.type === 'receive' ? 'success.main' : 'info.main',
                        fontWeight: 'bold'
                      }}
                    >
                      {transaction.amount_sol.toFixed(9)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.success ? 'Successo' : 'Fallita'}
                      color={transaction.success ? 'success' : 'error'}
                      size="small"
                      sx={{ minWidth: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`https://solscan.io/tx/${transaction.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ 
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      }}
                    >
                      {transaction.signature}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            {filteredTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nessuna transazione trovata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={filteredTransactions.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Righe per pagina:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} di ${count !== -1 ? count : `più di ${to}`}`
        }
      />
    </Box>
  );
};

export default TransactionLog;
