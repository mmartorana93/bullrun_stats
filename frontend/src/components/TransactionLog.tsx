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
          {tx.token && (
            <Box>
              <Link 
                href={tx.token.dexScreenerUrl} 
                target="_blank" 
                rel="noopener"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {tx.token.symbol}
                <OpenInNew fontSize="small" sx={{ ml: 0.5 }} />
              </Link>
            </Box>
          )}
        </TableCell>
        <TableCell>
          <Chip
            label={tx.type.toUpperCase()}
            color={tx.type === 'swap' ? 'warning' : tx.type === 'receive' ? 'success' : 'error'}
            size="small"
          />
        </TableCell>
        <TableCell>
          {tx.amount_sol.toFixed(4)} SOL
          {tx.token && tx.tokenAmount && (
            <Typography variant="body2" color="text.secondary">
              {tx.tokenAmount} {tx.token.symbol}
            </Typography>
          )}
        </TableCell>
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
                    Amount: {tx.tokenAmount} {tx.token.symbol}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    <Link href={tx.token.dexScreenerUrl} target="_blank" rel="noopener">
                      DEX
                    </Link>
                    {tx.links && (
                      <>
                        <Link href={tx.links.photon} target="_blank" rel="noopener">
                          PHT
                        </Link>
                        <Link href={tx.links.rugcheck} target="_blank" rel="noopener">
                          RUG
                        </Link>
                      </>
                    )}
                  </Box>
                </Box>
              )}

              {tx.preBalances && tx.postBalances && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Balance Changes:</Typography>
                  <Typography variant="body2">
                    SOL: {tx.preBalances.sol.toFixed(4)} → {tx.postBalances.sol.toFixed(4)}
                    <br />
                    {tx.token && `${tx.token.symbol}: ${tx.preBalances.token} → ${tx.postBalances.token}`}
                  </Typography>
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
  const rawTransactions = useTransactions();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Assicurati che transactions sia sempre un array
  const transactions = Array.isArray(rawTransactions) ? rawTransactions : [];

  useEffect(() => {
    const logNewTransactions = async () => {
      if (transactions.length === 0) return;
      
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
    return [...transactions].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions]);

  // Calcola l'indice di inizio e fine per la paginazione
  const startIndex = page * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Log delle Transazioni
      </Typography>

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
            {paginatedTransactions.map((tx: Transaction) => (
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
