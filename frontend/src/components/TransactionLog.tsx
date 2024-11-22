import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Tooltip,
  Stack
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  ContentCopy,
  OpenInNew
} from '@mui/icons-material';
import { Transaction } from '../types';
import LoggingService from '../services/loggingService';
import { shortenAddress, formatDate, formatTimeAgo } from '../utils/format';
import { useTransactions } from '../store/realTimeStore';
import { useWebSocket } from '../contexts/WebSocketContext';

const getSolscanUrl = (type: 'wallet' | 'tx', value: string) => {
  const baseUrl = 'https://solscan.io';
  return type === 'wallet' ? `${baseUrl}/account/${value}` : `${baseUrl}/tx/${value}`;
};

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
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Copia indirizzo">
              <IconButton size="small" onClick={() => copyToClipboard(tx.wallet)}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
            <Link
              href={getSolscanUrl('wallet', tx.wallet)}
              target="_blank"
              rel="noopener"
              sx={{ display: 'flex', alignItems: 'center', color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {shortenAddress(tx.wallet)}
              <OpenInNew fontSize="small" sx={{ ml: 0.5 }} />
            </Link>
          </Stack>
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
          {tx.token?.createdAt && (
            <Tooltip title={formatDate(tx.token.createdAt * 1000)}>
              <span>{formatTimeAgo(tx.token.createdAt)}</span>
            </Tooltip>
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
          {(tx.amount_sol ?? 0).toFixed(4)} SOL
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
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Dettagli Transazione
              </Typography>
              
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2">Signature:</Typography>
                <Tooltip title="Copia signature">
                  <IconButton size="small" onClick={() => copyToClipboard(tx.signature)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Link
                  href={getSolscanUrl('tx', tx.signature)}
                  target="_blank"
                  rel="noopener"
                  sx={{ display: 'flex', alignItems: 'center', color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {shortenAddress(tx.signature)}
                  <OpenInNew fontSize="small" sx={{ ml: 0.5 }} />
                </Link>
              </Stack>

              {tx.token && (
                <Box sx={{ mb: 2, mt: 2 }}>
                  <Typography variant="subtitle2">Token Details:</Typography>
                  <Typography variant="body2">
                    Address: {shortenAddress(tx.token.address)}
                    <br />
                    Price: ${tx.token.priceUsd}
                    <br />
                    Amount: {tx.tokenAmount} {tx.token.symbol}
                    {tx.token.createdAt && (
                      <>
                        <br />
                        Created: {formatDate(tx.token.createdAt * 1000)}
                      </>
                    )}
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { socket } = useWebSocket();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Limita il numero massimo di transazioni memorizzate
  const MAX_TRANSACTIONS = 1000;

  useEffect(() => {
    // Inizializza l'audio e precaricalo
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.load();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('newTransaction', async (transaction: Transaction) => {
      try {
        if (audioRef.current) {
          // Resetta l'audio al punto iniziale
          audioRef.current.currentTime = 0;
          // Riproduci il suono
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('Errore riproduzione audio:', error);
            });
          }
        }
      } catch (error) {
        console.error('Errore gestione audio:', error);
      }
      
      setTransactions(prev => {
        const newTx = [transaction, ...prev];
        return newTx.slice(0, MAX_TRANSACTIONS);
      });
    });

    return () => {
      socket.off('newTransaction');
    };
  }, [socket]);

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

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 200px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Wallet</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Created</TableCell>
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
