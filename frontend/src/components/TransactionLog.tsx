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
  IconButton,
  Collapse,
  Tooltip
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  ContentCopy,
  OpenInNew
} from '@mui/icons-material';
import { Transaction } from '../types';
import LoggingService from '../services/loggingService';
import { shortenAddress, formatDate } from '../utils/format';
import { useTransactions } from '../store/realTimeStore';

const Row = ({ tx }: { tx: Transaction }) => {
  const [open, setOpen] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Tooltip title="Copia indirizzo">
            <IconButton size="small" onClick={() => copyToClipboard(tx.wallet)}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          {shortenAddress(tx.wallet)}
        </TableCell>
        <TableCell>
          {tx.token ? (
            <Link href={tx.token.dexScreenerUrl} target="_blank" rel="noopener">
              {tx.token.symbol}
              <OpenInNew fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
            </Link>
          ) : 'SOL'}
        </TableCell>
        <TableCell>
          <Chip
            label={tx.type.toUpperCase()}
            color={tx.type === 'receive' ? 'success' : 'error'}
            size="small"
          />
        </TableCell>
        <TableCell>{tx.amount_sol.toFixed(4)} SOL</TableCell>
        <TableCell>
          <Chip
            label={tx.success ? 'SUCCESS' : 'FAILED'}
            color={tx.success ? 'success' : 'error'}
            size="small"
          />
        </TableCell>
        <TableCell>{formatDate(tx.timestamp)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Dettagli Transazione
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                Signature:
                <Tooltip title="Copia signature">
                  <IconButton size="small" onClick={() => copyToClipboard(tx.signature)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
                {shortenAddress(tx.signature)}
              </Typography>

              {tx.token && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Token Details:</Typography>
                  <Typography variant="body2">
                    Address: {shortenAddress(tx.token.address)}
                    <br />
                    Price: ${tx.token.priceUsd}
                    <br />
                    Created: {new Date(tx.token.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {tx.tokenChanges && tx.tokenChanges.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Token Changes:</Typography>
                  {tx.tokenChanges.map((change, i) => (
                    <Typography key={i} variant="body2">
                      {shortenAddress(change.tokenAddress)}: {change.preAmount} → {change.postAmount}
                    </Typography>
                  ))}
                </Box>
              )}

              {tx.logMessages && tx.logMessages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Log Messages:</Typography>
                  <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                    {tx.logMessages.map((log, i) => (
                      <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {log}
                      </Typography>
                    ))}
                  </Paper>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

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
              <TableCell />
              <TableCell>Wallet</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Timestamp</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(transactions) && transactions.map((tx: Transaction) => (
              <Row key={tx.signature} tx={tx} />
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
