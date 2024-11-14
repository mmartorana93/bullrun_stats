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
import { shortenAddress, formatDate } from '../utils/format';
import { useTransactions } from '../store/realTimeStore';

const TransactionLog: React.FC = () => {
  const transactions = useTransactions();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchWallet, setSearchWallet] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const logNewTransactions = async () => {
      if (!Array.isArray(transactions)) return;
      
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
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((transaction: Transaction) => {
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
              <TableCell>Wallet</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Importo (SOL)</TableCell>
              <TableCell>Età</TableCell>
              <TableCell>Timestamp</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(transactions) && transactions.map((tx: Transaction) => (
              <TableRow key={tx.signature}>
                <TableCell>{shortenAddress(tx.wallet)}</TableCell>
                <TableCell>{tx.tokenSymbol || 'N/A'}</TableCell>
                <TableCell>{tx.type}</TableCell>
                <TableCell>{tx.amount_sol}</TableCell>
                <TableCell>{tx.age ? `${tx.age}s` : 'N/A'}</TableCell>
                <TableCell>{formatDate(tx.timestamp)}</TableCell>
              </TableRow>
            ))}
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
