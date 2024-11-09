import React, { useEffect, useState, useCallback } from 'react';
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
    Badge
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useWebSocket } from '../contexts/WebSocketContext';

interface Pool {
    tokenAccount: string;
    tokenAmount: number;
    solanaAmount: number;
    usdValue: number;
    timestamp: string;
    txId: string;
    riskAnalysis: {
        flags: {
            mutable_metadata: boolean;
            freeze_authority_enabled: boolean;
            mint_authority_enabled: boolean;
        };
        isSafeToBuy: boolean;
    };
}

interface FilterSettings {
    minUsd: number;
    maxUsd: number;
    showOnlyInRange: boolean;
}

const STORAGE_KEY = 'lptracking_pools';
const FILTER_SETTINGS_KEY = 'lptracking_filters';

const DEFAULT_FILTERS: FilterSettings = {
    minUsd: 1000,
    maxUsd: 30000,
    showOnlyInRange: false
};

const LPTracking: React.FC = () => {
    const { socket, isConnected } = useWebSocket();
    const [pools, setPools] = useState<Pool[]>(() => {
        try {
            const savedPools = localStorage.getItem(STORAGE_KEY);
            return savedPools ? JSON.parse(savedPools) : [];
        } catch (error) {
            console.error('Errore nel parsing dei pool salvati:', error);
            return [];
        }
    });

    const [filters, setFilters] = useState<FilterSettings>(() => {
        try {
            const savedFilters = localStorage.getItem(FILTER_SETTINGS_KEY);
            return savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS;
        } catch (error) {
            console.error('Errore nel parsing dei filtri salvati:', error);
            return DEFAULT_FILTERS;
        }
    });

    const [newPoolsCount, setNewPoolsCount] = useState(0);

    // Salva i pool nel localStorage quando cambiano
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pools));
        } catch (error) {
            console.error('Errore nel salvataggio dei pool:', error);
        }
    }, [pools]);

    // Salva i filtri nel localStorage quando cambiano
    useEffect(() => {
        try {
            localStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(filters));
        } catch (error) {
            console.error('Errore nel salvataggio dei filtri:', error);
        }
    }, [filters]);

    const handleNewPool = useCallback((poolData: Pool) => {
        console.log('Ricevuto nuovo pool:', poolData);
        setPools(prevPools => {
            const newPools = [poolData, ...prevPools];
            const updatedPools = newPools.slice(0, 100);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPools));
            } catch (error) {
                console.error('Errore nel salvataggio dei pool:', error);
            }
            return updatedPools;
        });
        // Incrementa il contatore dei nuovi pool
        setNewPoolsCount(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!socket) return;

        if (isConnected) {
            socket.emit('getPools');
        }

        const handleExistingPools = (existingPools: Pool[]) => {
            console.log('Ricevuti pool esistenti:', existingPools);
            setPools(existingPools);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(existingPools));
            } catch (error) {
                console.error('Errore nel salvataggio dei pool:', error);
            }
        };

        socket.on('newPool', handleNewPool);
        socket.on('existingPools', handleExistingPools);

        return () => {
            socket.off('newPool', handleNewPool);
            socket.off('existingPools', handleExistingPools);
        };
    }, [socket, isConnected, handleNewPool]);

    // Reset del contatore quando il componente diventa visibile
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

    const isInRange = (pool: Pool) => {
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

    const getRiskStatus = (riskAnalysis: Pool['riskAnalysis']) => {
        if (!riskAnalysis) return null;

        const { flags, isSafeToBuy } = riskAnalysis;
        const activeFlags = Object.entries(flags).filter(([_, value]) => value);

        if (isSafeToBuy) {
            return (
                <Chip
                    icon={<CheckCircleIcon />}
                    label="Sicuro"
                    color="success"
                    size="small"
                />
            );
        } else {
            return (
                <Box>
                    <Chip
                        icon={<ErrorIcon />}
                        label="Rischio"
                        color="error"
                        size="small"
                    />
                    <Box sx={{ mt: 1 }}>
                        {activeFlags.map(([flag]) => (
                            <Chip
                                key={flag}
                                icon={<WarningIcon />}
                                label={flag.replace(/_/g, ' ')}
                                color="warning"
                                size="small"
                                sx={{ m: 0.5 }}
                            />
                        ))}
                    </Box>
                </Box>
            );
        }
    };

    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="div">
                    Nuove Pool di Liquidità
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
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
                            <TableRow 
                                key={pool.txId} 
                                hover
                                sx={{
                                    backgroundColor: isInRange(pool) ? 'inherit' : 'action.hover'
                                }}
                            >
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
                                <TableCell>{getRiskStatus(pool.riskAnalysis)}</TableCell>
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
                        ))}
                        {filteredPools.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
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
