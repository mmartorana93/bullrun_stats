import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box
} from '@mui/material';

interface TokenStats {
  symbol: string;
  name: string;
  tradingWallets: number;
  price: string;
  change24h: string;
}

// Dati mock per simulare i token più tradati
const mockTokens: TokenStats[] = [
  {
    symbol: 'BONK',
    name: 'Bonk',
    tradingWallets: 8,
    price: '$0.000012',
    change24h: '+15.2%'
  },
  {
    symbol: 'JTO',
    name: 'Jito',
    tradingWallets: 6,
    price: '$2.45',
    change24h: '+8.7%'
  },
  {
    symbol: 'WEN',
    name: 'Wen Token',
    tradingWallets: 5,
    price: '$0.00145',
    change24h: '-3.2%'
  },
  {
    symbol: 'PYTH',
    name: 'Pyth Network',
    tradingWallets: 4,
    price: '$0.42',
    change24h: '+2.1%'
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    tradingWallets: 3,
    price: '$1.23',
    change24h: '-1.5%'
  }
];

const TokenRanking: React.FC = () => {
  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Token Più Tradati
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell align="right">Wallet Attivi</TableCell>
              <TableCell align="right">Prezzo</TableCell>
              <TableCell align="right">24h</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockTokens.map((token, index) => (
              <TableRow
                key={token.symbol}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  #{index + 1}
                </TableCell>
                <TableCell>{token.symbol}</TableCell>
                <TableCell>{token.name}</TableCell>
                <TableCell align="right">{token.tradingWallets}</TableCell>
                <TableCell align="right">{token.price}</TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    color: token.change24h.startsWith('+') ? 'success.main' : 'error.main'
                  }}
                >
                  {token.change24h}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TokenRanking;
