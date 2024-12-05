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
    CircularProgress,
    Alert,
} from '@mui/material';
import { useHoldingsService } from '../hooks/useHoldingsService';

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
    const { holdings, loading, error } = useHoldingsService();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!holdings) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                Nessun dato disponibile
            </Alert>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Il Mio Portfolio
            </Typography>

            <WalletSummary stats={holdings} />

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
                        {holdings.tokens.length > 0 ? (
                            holdings.tokens.map((token) => (
                                <TableRow key={token.address}>
                                    <TableCell>
                                        {token.name || token.symbol}
                                    </TableCell>
                                    <TableCell align="right">
                                        {token.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        ${token.price.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        ${token.value.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    Nessun token trovato
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default MyHoldings;
