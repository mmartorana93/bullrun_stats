import React, { useState, useEffect } from 'react';
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
    IconButton,
    Chip,
    Stack,
    Switch,
    FormControlLabel,
    Tooltip,
    Link,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    KeyboardArrowDown,
    KeyboardArrowUp,
    ContentCopy,
    OpenInNew,
    Refresh,
    TrendingUp,
    TrendingDown
} from '@mui/icons-material';
import { TokenHolding, HoldingsStats } from '../services/holdingsService';
import { useHoldingsService } from '../hooks/useHoldingsService';
import { formatUSD, formatPercentage, shortenAddress } from '../utils/format';

interface ExpandableRowProps {
    holding: TokenHolding;
    onCopy: (text: string) => void;
}

const ExpandableRow: React.FC<ExpandableRowProps> = ({ holding, onCopy }) => {
    const [open, setOpen] = useState(false);

    const getPnLColor = (value: number | 'N/A') => {
        if (value === 'N/A') return 'text.secondary';
        return value >= 0 ? 'success.main' : 'error.main';
    };

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setOpen(!open)}
                    >
                        {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {holding.symbol}
                        <Tooltip title="Copia indirizzo">
                            <IconButton size="small" onClick={() => onCopy(holding.address)}>
                                <ContentCopy fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Chip
                            label="Trading"
                            color="primary"
                            size="small"
                        />
                    </Stack>
                </TableCell>
                <TableCell align="right">{formatUSD(holding.invested)}</TableCell>
                <TableCell align="right">{formatUSD(holding.remaining)}</TableCell>
                <TableCell align="right">{formatUSD(holding.sold)}</TableCell>
                <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Typography color={getPnLColor(holding.pnl)}>
                            {holding.pnl === 'N/A' ? 'N/A' : formatUSD(holding.pnl)}
                        </Typography>
                        <Typography color={getPnLColor(holding.pnlPercentage)}>
                            ({holding.pnlPercentage === 'N/A' ? 'N/A' : formatPercentage(holding.pnlPercentage)})
                        </Typography>
                    </Stack>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Box sx={{ margin: 1 }}>
                        <Typography variant="h6" gutterBottom component="div">
                            Dettagli Token
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Wallet</TableCell>
                                    <TableCell align="right">Quantità</TableCell>
                                    <TableCell align="right">Ultimo Prezzo</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {holding.wallets.map((wallet) => (
                                    <TableRow key={wallet.address}>
                                        <TableCell>
                                            <Link
                                                href={`https://solscan.io/account/${wallet.address}`}
                                                target="_blank"
                                                rel="noopener"
                                                sx={{ display: 'flex', alignItems: 'center' }}
                                            >
                                                {shortenAddress(wallet.address)}
                                                <OpenInNew fontSize="small" sx={{ ml: 0.5 }} />
                                            </Link>
                                        </TableCell>
                                        <TableCell align="right">{wallet.amount}</TableCell>
                                        <TableCell align="right">
                                            {holding.lastPrice ? formatUSD(holding.lastPrice) : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {holding.error && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                {holding.error}
                            </Alert>
                        )}
                    </Box>
                </TableCell>
            </TableRow>
        </>
    );
};

const MyHoldings: React.FC = () => {
    const holdingsService = useHoldingsService();
    const [holdings, setHoldings] = useState<TokenHolding[]>([]);
    const [stats, setStats] = useState<HoldingsStats | null>(null);
    const [showEmpty, setShowEmpty] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
        
        // Subscribe to real-time updates
        holdingsService.subscribeToUpdates((updatedHoldings) => {
            setHoldings(updatedHoldings);
            loadStats();
        });

        return () => {
            holdingsService.unsubscribeFromUpdates((updatedHoldings) => {
                setHoldings(updatedHoldings);
                loadStats();
            });
        };
    }, [holdingsService]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [holdingsData, statsData] = await Promise.all([
                holdingsService.getHoldings(),
                holdingsService.getStats()
            ]);
            setHoldings(holdingsData);
            setStats(statsData);
        } catch (err) {
            setError('Errore nel caricamento dei dati');
            console.error('Errore nel caricamento dei dati:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const statsData = await holdingsService.getStats();
            setStats(statsData);
        } catch (err) {
            console.error('Errore nel caricamento delle statistiche:', err);
        }
    };

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await holdingsService.refreshPrices();
        } catch (err) {
            setError('Errore nell\'aggiornamento dei prezzi');
            console.error('Errore nell\'aggiornamento dei prezzi:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const filteredHoldings = showEmpty 
        ? holdings 
        : holdings.filter(h => h.remaining > 0);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Stack 
                direction="row" 
                spacing={2} 
                alignItems="center" 
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Typography variant="h6">
                    I Miei Holdings
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showEmpty}
                                onChange={(e) => setShowEmpty(e.target.checked)}
                            />
                        }
                        label="Mostra posizioni vuote"
                    />
                    <IconButton 
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <Refresh />
                    </IconButton>
                </Stack>
            </Stack>

            {stats && (
                <Paper sx={{ p: 2, mb: 2 }}>
                    <Stack direction="row" spacing={4}>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">
                                Totale Investito
                            </Typography>
                            <Typography variant="h6">
                                {formatUSD(stats.totalInvested)}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">
                                P&L Totale
                            </Typography>
                            <Typography 
                                variant="h6" 
                                color={stats.totalPnL >= 0 ? 'success.main' : 'error.main'}
                            >
                                {formatUSD(stats.totalPnL)}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">
                                Holdings
                            </Typography>
                            <Typography variant="h6">
                                {stats.holdingsCount}
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            <TableCell>Token</TableCell>
                            <TableCell align="right">Investito</TableCell>
                            <TableCell align="right">Rimanente</TableCell>
                            <TableCell align="right">Venduto</TableCell>
                            <TableCell align="right">P&L</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredHoldings.map((holding) => (
                            <ExpandableRow
                                key={holding.address}
                                holding={holding}
                                onCopy={copyToClipboard}
                            />
                        ))}
                        {filteredHoldings.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    Nessun holding trovato
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
