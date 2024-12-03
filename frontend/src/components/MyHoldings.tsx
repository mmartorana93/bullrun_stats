import React from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Stack,
} from '@mui/material';

interface TokenHolding {
    symbol: string;
    name?: string;
    address: string;
    amount: number;
    price: number;
    value: number;
}

interface HoldingsStats {
    totalValueUSD: number;
    solBalance: number;
    solPrice: number;
    solValue: number;
}

const WalletSummary: React.FC<{ stats: HoldingsStats }> = ({ stats }) => {
    return (
        <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={4}>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                        Valore Totale Portfolio
                    </Typography>
                    <Typography variant="h6">
                        ${stats.totalValueUSD.toLocaleString()}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                        SOL Balance
                    </Typography>
                    <Typography variant="h6">
                        {stats.solBalance.toLocaleString()} SOL
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                        SOL Price
                    </Typography>
                    <Typography variant="h6">
                        ${stats.solPrice.toLocaleString()}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                        SOL Value
                    </Typography>
                    <Typography variant="h6">
                        ${stats.solValue.toLocaleString()}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
};

const MyHoldings: React.FC = () => {
    const mockStats: HoldingsStats = {
        totalValueUSD: 0,
        solBalance: 0,
        solPrice: 0,
        solValue: 0
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Il Mio Portfolio
            </Typography>

            <WalletSummary stats={mockStats} />

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Token</TableCell>
                            <TableCell align="right">Quantità</TableCell>
                            <TableCell align="right">Prezzo</TableCell>
                            <TableCell align="right">Valore (USD)</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={4} align="center">
                                Nessun token trovato
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default MyHoldings;
