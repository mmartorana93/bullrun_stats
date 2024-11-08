import React, { useState } from 'react';
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
} from '@mui/material';
import { Transaction } from '../types';

interface TransactionLogProps {
  transactions: Transaction[];
}

const TransactionLog: React.FC<TransactionLogProps> = ({ transactions }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Log delle Transazioni
      </Typography>
      <TableContainer component={Paper}>
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
            {sortedTransactions
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((transaction, index) => (
                <TableRow key={transaction.signature}>
                  <TableCell>{transaction.timestamp}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {transaction.wallet}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.type}
                      color={transaction.type === 'receive' ? 'success' : 'info'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={transaction.type === 'receive' ? 'success.main' : 'info.main'}
                    >
                      {transaction.amount_sol.toFixed(9)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.success ? 'Successo' : 'Fallita'}
                      color={transaction.success ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`https://solscan.io/tx/${transaction.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ wordBreak: 'break-all' }}
                    >
                      {transaction.signature}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            {sortedTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nessuna transazione registrata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={sortedTransactions.length}
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
