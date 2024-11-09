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
    Badge,
    CircularProgress,
    Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import { useWebSocket } from '../contexts/WebSocketContext';
import { rugcheckService } from '../services/rugcheckService';
import { dextoolsService } from '../services/dextoolsService';
import { useLPHistory } from '../hooks/useLPHistory';

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

const DEFAULT_FILTERS: FilterSettings = {
    minUsd: 1000,
    maxUsd: 30000,
    showOnlyInRange: false
};

const FILTER_SETTINGS_KEY = 'lptracking_filters';

const LPTracking: React.FC = () => {
    const { socket, isConnected } = useWebSocket();
    const { addPool } = useLPHistory();
    const [pools, setPools] = useState<Pool[]>([]);
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
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(filters));
        } catch (error) {
            console.error('Errore nel salvataggio dei filtri:', error);
        }
    }, [filters]);

    const analyzeToken = useCallback(async (tokenAddress: string) => {
        try {
            const [riskAnalysis, tokenPrice] = await Promise.all([
                rugcheckService.analyzeToken(tokenAddress),
                dextoolsService.getTokenPrice(tokenAddress)
            ]);

            return riskAnalysis;
        } catch (error) {
            console.error('Errore nell\'analisi del token:', error);
            return {
                flags: {
                    mutable_metadata: false,
                    freeze_authority_enabled: false,
                    mint_authority_enabled: false
                },
                isSafeToBuy: false
            };
        }
    }, []);

    const handleNewPool = useCallback(async (poolData: Pool) => {
        setIsLoading(true);
        try {
            const riskAnalysis = await analyzeToken(poolData.tokenAccount);
            const enrichedPool = {
                ...poolData,
                riskAnalysis
            };

            setPools(prevPools => {
                const newPools = [enrichedPool, ...prevPools].slice(0, 100);
                return newPools;
            });

            addPool(enrichedPool);
            setNewPoolsCount(prev => prev + 1);
        } catch (error) {
            console.error('Errore nella gestione del nuovo pool:', error);
        } finally {
            setIsLoading(false);
        }
    }, [addPool, analyzeToken]);

    useEffect(() => {
        if (!socket) return;

        if (isConnected) {
            socket.emit('getPools');
        }

        const handleExistingPools = async (existingPools: Pool[]) => {
            setIsLoading(true);
            try {
                const enrichedPools = await Promise.all(
                    existingPools.map(async pool => ({
                        ...pool,
                        riskAnalysis: await analyzeToken(pool.tokenAccount)
                    }))
                );
                setPools(enrichedPools);
            } catch (error) {
                console.error('Errore nel caricamento dei pool esistenti:', error);
            } finally {
                setIsLoading(false);
            }
        };

        socket.on('newPool', handleNewPool);
        socket.on('existingPools', handleExistingPools);

        return () => {
            socket.off('newPool', handleNewPool);
            socket.off('existingPools', handleExistingPools);
        };
    }, [socket, isConnected, handleNewPool, analyzeToken]);

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

        return (
            <Stack direction="row" spacing={1} flexWrap="wrap">
                {isSafeToBuy ? (
                    <Tooltip title="Token Sicuro">
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Sicuro"
                            color="success"
                            size="small"
                        />
                    </Tooltip>
                ) : (
                    <Tooltip title="Token Rischioso">
                        <Chip
                            icon={<ErrorIcon />}
                            label="Rischio"
                            color="error"
                            size="small"
                        />
                    </Tooltip>
                )}
                
                {flags.mutable_metadata && (
                    <Tooltip title="I metadata del token possono essere modificati">
                        <Chip
                            icon={<EditIcon />}
                            label="Metadata Mutabile"
                            color="warning"
                            size="small"
                        />
                    </Tooltip>
                )}
                
                {flags.freeze_authority_enabled && (
                    <Tooltip title="L'autorità di congelamento è ancora abilitata">
                        <Chip
                            icon={<LockIcon />}
                            label="Freeze Authority"
                            color="warning"
                            size="small"
                        />
                    </Tooltip>
                )}
                
                {flags.mint_authority_enabled && (
                    <Tooltip title="L'autorità di conio è ancora abilitata">
                        <Chip
                            icon={<LocalAtmIcon />}
                            label="Mint Authority"
                            color="warning"
                            size="small"
                        />
                    </Tooltip>
                )}
            </Stack>
        );
    };

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
