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
    Chip,
    Link,
    TextField,
    Switch,
    FormControlLabel,
    Stack,
    InputAdornment,
    Badge,
    CircularProgress,
    Tooltip,
    Collapse,
    IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useRealTimeStore } from '../store/realTimeStore';
import LoggingService from '../services/loggingService';
import api from '../api/config';

interface FilterSettings {
    minUsd: number;
    maxUsd: number;
    showOnlyInRange: boolean;
}

interface ExpandableRowProps {
    pool: any;
    isInRange: boolean;
    formatTime: (timestamp: string) => string;
    formatUSD: (value: number) => string;
    getRiskStatus: (riskAnalysis: any) => React.ReactNode;
}

const ExpandableRow: React.FC<ExpandableRowProps> = ({ pool, isInRange, formatTime, formatUSD, getRiskStatus }) => {
    const [open, setOpen] = useState(false);

    const getMetricsDetails = (metrics: any, changes: any) => {
        if (!metrics) return null;

        return (
            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle2" gutterBottom>
                    Metriche Pool:
                </Typography>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Prezzo Token:
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Chip
                                icon={<span>₳</span>}
                                label={`${metrics.pricePerTokenSOL.toFixed(8)} SOL`}
                                size="small"
                            />
                            <Chip
                                icon={<span>$</span>}
                                label={`${metrics.pricePerTokenUSD.toFixed(4)} USD`}
                                size="small"
                            />
                            {changes && (
                                <>
                                    <Chip
                                        icon={changes.priceChangeSOL > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                        label={`${changes.priceChangeSOL.toFixed(2)}%`}
                                        color={changes.priceChangeSOL > 0 ? "success" : "error"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={changes.priceChangeUSD > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                        label={`${changes.priceChangeUSD.toFixed(2)}%`}
                                        color={changes.priceChangeUSD > 0 ? "success" : "error"}
                                        size="small"
                                    />
                                </>
                            )}
                        </Stack>
                    </Box>
                    <Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Liquidità:
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Chip
                                label={`Profondità: ${metrics.poolDepth.toFixed(2)}`}
                                size="small"
                            />
                            <Chip
                                label={`Normalizzata: ${metrics.normalizedLiquidity.toFixed(2)}`}
                                size="small"
                            />
                            {changes && (
                                <Chip
                                    icon={changes.liquidityChange > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                    label={`${changes.liquidityChange.toFixed(2)}%`}
                                    color={changes.liquidityChange > 0 ? "success" : "error"}
                                    size="small"
                                />
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        );
    };

    const getRiskDetails = (riskAnalysis: any) => {
        if (!riskAnalysis) return null;
        
        const { flags } = riskAnalysis;
        return (
            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle2" gutterBottom>
                    Dettagli Analisi Rischi:
                </Typography>
                <Stack spacing={1}>
                    <Box>
                        <Typography variant="body2" color="textSecondary">
                            Metadata Mutabile:
                        </Typography>
                        <Chip
                            icon={flags.mutable_metadata ? <WarningIcon /> : <CheckCircleIcon />}
                            label={flags.mutable_metadata ? "Sì" : "No"}
                            color={flags.mutable_metadata ? "warning" : "success"}
                            size="small"
                        />
                    </Box>
                    <Box>
                        <Typography variant="body2" color="textSecondary">
                            Freeze Authority:
                        </Typography>
                        <Chip
                            icon={flags.freeze_authority_enabled ? <WarningIcon /> : <CheckCircleIcon />}
                            label={flags.freeze_authority_enabled ? "Abilitato" : "Disabilitato"}
                            color={flags.freeze_authority_enabled ? "warning" : "success"}
                            size="small"
                        />
                    </Box>
                    <Box>
                        <Typography variant="body2" color="textSecondary">
                            Mint Authority:
                        </Typography>
                        <Chip
                            icon={flags.mint_authority_enabled ? <WarningIcon /> : <CheckCircleIcon />}
                            label={flags.mint_authority_enabled ? "Abilitato" : "Disabilitato"}
                            color={flags.mint_authority_enabled ? "warning" : "success"}
                            size="small"
                        />
                    </Box>
                </Stack>
            </Box>
        );
    };

    return (
        <>
            <TableRow 
                hover
                sx={{
                    backgroundColor: isInRange ? 'inherit' : 'action.hover',
                    '& > *': { borderBottom: 'unset' }
                }}
            >
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setOpen(!open)}
                    >
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>{formatTime(pool.timestamp)}</TableCell>
                <TableCell>
                    <Link 
                        href={`https://solscan.io/token/${pool.tokenAccount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {`${pool.tokenAccount.slice(0, 4)}...${pool.tokenAccount.slice(-4)}`}
                    </Link>
                </TableCell>
                <TableCell align="right">{pool.tokenAmount.toLocaleString()}</TableCell>
                <TableCell align="right">{pool.solanaAmount.toFixed(2)}</TableCell>
                <TableCell align="right">{formatUSD(pool.usdValue)}</TableCell>
                <TableCell>{pool.riskAnalysis && getRiskStatus(pool.riskAnalysis)}</TableCell>
                <TableCell>
                    <Link 
                        href={`https://solscan.io/tx/${pool.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View
                    </Link>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Stack spacing={2}>
                            {getMetricsDetails(pool.metrics, pool.changes)}
                            {pool.riskAnalysis && getRiskDetails(pool.riskAnalysis)}
                        </Stack>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

const DEFAULT_FILTERS: FilterSettings = {
    minUsd: 1000,
    maxUsd: 30000,
    showOnlyInRange: false
};

const FILTER_SETTINGS_KEY = 'lptracking_filters';

const LPTracking: React.FC = () => {
    const { isConnected } = useWebSocket();
    const { pools, isLoading } = useRealTimeStore();
    const [newPoolsCount, setNewPoolsCount] = useState(0);
    const [filters, setFilters] = useState<FilterSettings>(() => {
        try {
            const savedFilters = localStorage.getItem(FILTER_SETTINGS_KEY);
            return savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS;
        } catch (error) {
            console.error('Errore nel parsing dei filtri salvati:', error);
            return DEFAULT_FILTERS;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(filters));
        } catch (error) {
            console.error('Errore nel salvataggio dei filtri:', error);
        }
    }, [filters]);

    useEffect(() => {
        // Log new pools when they arrive
        const logNewPools = async () => {
            for (const pool of pools) {
                await LoggingService.logLPTracking({
                    timestamp: pool.timestamp,
                    tokenAccount: pool.tokenAccount,
                    tokenAmount: pool.tokenAmount,
                    solanaAmount: pool.solanaAmount,
                    usdValue: pool.usdValue,
                    txId: pool.txId,
                    riskAnalysis: pool.riskAnalysis
                });
            }
        };

        if (pools.length > 0) {
            logNewPools();
            setNewPoolsCount(prev => prev + 1);
        }
    }, [pools]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                setNewPoolsCount(0);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleFilterChange = (field: keyof FilterSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = field === 'showOnlyInRange' ? event.target.checked : Number(event.target.value);
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const isInRange = (pool: any) => {
        return pool.usdValue >= filters.minUsd && pool.usdValue <= filters.maxUsd;
    };

    const filteredPools = pools.filter(pool => 
        !filters.showOnlyInRange || isInRange(pool)
    );

    const formatUSD = (value: number) => {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('it-IT');
    };

    const getRiskStatus = (riskAnalysis: any) => {
        if (!riskAnalysis) return null;

        const { flags, isSafeToBuy } = riskAnalysis;
        const activeFlags = Object.entries(flags).filter(([_, value]) => value);

        return (
            <Stack direction="row" spacing={1}>
                {isSafeToBuy ? (
                    <Tooltip title="Nessun rischio rilevato">
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Sicuro"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Tooltip>
                ) : (
                    <Tooltip title={`${activeFlags.length} rischi rilevati`}>
                        <Chip
                            icon={<ErrorIcon />}
                            label={`${activeFlags.length} Rischi`}
                            color="error"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Tooltip>
                )}
            </Stack>
        );
    };

    // Aggiungi check per feature flag
    const [isEnabled, setIsEnabled] = useState(false);
    
    useEffect(() => {
        // Controlla se la feature è abilitata
        const checkFeatureStatus = async () => {
            try {
                const response = await api.get('/api/features/lp-tracking');
                setIsEnabled(response.data.enabled);
            } catch (error) {
                console.error('Errore nel controllo dello stato della feature:', error);
                setIsEnabled(false);
            }
        };
        
        checkFeatureStatus();
    }, []);

    // Se la feature è disabilitata, non renderizzare nulla
    if (!isEnabled) {
        return null;
    }

    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="div">
                    Nuove Pool di Liquidità
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                    {isLoading && <CircularProgress size={24} />}
                    {newPoolsCount > 0 && (
                        <Badge badgeContent={newPoolsCount} color="primary">
                            <Chip
                                label="Nuovi Pool"
                                color="primary"
                                size="small"
                            />
                        </Badge>
                    )}
                    <Chip
                        label={isConnected ? 'Connesso' : 'Connesso (in background)'}
                        color="success"
                        size="small"
                    />
                </Stack>
            </Box>

            <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        label="Valore USD Minimo"
                        type="number"
                        value={filters.minUsd}
                        onChange={handleFilterChange('minUsd')}
                        size="small"
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                    />
                    <TextField
                        label="Valore USD Massimo"
                        type="number"
                        value={filters.maxUsd}
                        onChange={handleFilterChange('maxUsd')}
                        size="small"
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={filters.showOnlyInRange}
                                onChange={handleFilterChange('showOnlyInRange')}
                            />
                        }
                        label="Mostra solo in range"
                    />
                    <Typography variant="body2" color="textSecondary">
                        {`Mostrati ${filteredPools.length} pool su ${pools.length} totali`}
                    </Typography>
                </Stack>
            </Paper>

            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell style={{ width: 50 }} />
                            <TableCell>Orario</TableCell>
                            <TableCell>Token</TableCell>
                            <TableCell align="right">Quantità Token</TableCell>
                            <TableCell align="right">SOL</TableCell>
                            <TableCell align="right">Valore USD</TableCell>
                            <TableCell>Analisi Rischi</TableCell>
                            <TableCell>Explorer</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredPools.map((pool) => (
                            <ExpandableRow
                                key={pool.txId}
                                pool={pool}
                                isInRange={isInRange(pool)}
                                formatTime={formatTime}
                                formatUSD={formatUSD}
                                getRiskStatus={getRiskStatus}
                            />
                        ))}
                        {filteredPools.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    Nessun pool di liquidità trovato
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default LPTracking;
