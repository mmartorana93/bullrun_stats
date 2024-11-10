import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { useWebSocket } from '../contexts/WebSocketContext';

interface PricePoint {
  price: number;
  timestamp: number;
}

interface HourlyStats {
  hour: number;
  volume: number;
  transactions: number;
  avgValue: number;
}

interface RiskDistribution {
  riskLevel: string;
  count: number;
  percentage: number;
}

interface PoolMetrics {
  pricePerTokenSOL: number;
  pricePerTokenUSD: number;
  poolDepth: number;
  normalizedLiquidity: number;
  timestamp: number;
}

interface PoolChanges {
  priceChangeSOL: number;
  priceChangeUSD: number;
  liquidityChange: number;
  timeframe: number;
}

interface PoolData {
  tokenAccount: string;
  tokenAmount: number;
  solanaAmount: number;
  usdValue: number;
  timestamp: string;
  txId: string;
  metrics: PoolMetrics;
  changes?: PoolChanges;
}

interface LPAnalyticsProps {
  priceHistory: PricePoint[];
  hourlyStats: HourlyStats[];
  riskDistribution: RiskDistribution[];
}

const RISK_COLORS = {
  'Basso': '#4caf50',
  'Medio': '#ff9800',
  'Alto': '#f44336'
};

const LPAnalytics: React.FC<LPAnalyticsProps> = ({
  priceHistory,
  hourlyStats,
  riskDistribution
}) => {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { socket } = useWebSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewPool = (poolData: PoolData) => {
      setPools(prev => {
        const newPools = [poolData, ...prev].slice(0, 100);
        return newPools;
      });
    };

    socket.on('newPool', handleNewPool);

    return () => {
      socket.off('newPool', handleNewPool);
    };
  }, [socket]);

  const formatNumber = (num: number, decimals: number = 4): string => {
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatUSD = (num: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatPercentage = (num: number): string => {
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    if (change > 5) return '#4caf50';
    if (change > 0) return '#81c784';
    if (change < -5) return '#f44336';
    if (change < 0) return '#e57373';
    return '#9e9e9e';
  };

  const renderMetricsRow = (pool: PoolData) => {
    if (!pool.metrics) return null;

    return (
      <TableRow>
        <TableCell colSpan={6}>
          <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
            <Typography variant="subtitle2" gutterBottom>
              Metriche Dettagliate
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Prezzo per Token
                </Typography>
                <Typography>
                  {formatNumber(pool.metrics.pricePerTokenSOL)} SOL
                  <br />
                  {formatUSD(pool.metrics.pricePerTokenUSD)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Profondità Pool
                </Typography>
                <Typography>
                  {formatNumber(pool.metrics.poolDepth)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Liquidità Normalizzata
                </Typography>
                <Typography>
                  {formatNumber(pool.metrics.normalizedLiquidity)}
                </Typography>
              </Box>
              {pool.changes && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Variazioni ({(pool.changes.timeframe / 1000).toFixed(1)}s)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`SOL: ${formatPercentage(pool.changes.priceChangeSOL)}`}
                      sx={{ backgroundColor: getChangeColor(pool.changes.priceChangeSOL) }}
                    />
                    <Chip
                      size="small"
                      label={`USD: ${formatPercentage(pool.changes.priceChangeUSD)}`}
                      sx={{ backgroundColor: getChangeColor(pool.changes.priceChangeUSD) }}
                    />
                    <Chip
                      size="small"
                      label={`LIQ: ${formatPercentage(pool.changes.liquidityChange)}`}
                      sx={{ backgroundColor: getChangeColor(pool.changes.liquidityChange) }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  const renderStatistics = () => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        Statistiche
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Volume 24h
          </Typography>
          <Typography variant="h6">
            {formatUSD(hourlyStats.reduce((acc, stat) => acc + stat.volume, 0))}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Transazioni 24h
          </Typography>
          <Typography variant="h6">
            {hourlyStats.reduce((acc, stat) => acc + stat.transactions, 0)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Valore Medio
          </Typography>
          <Typography variant="h6">
            {formatUSD(hourlyStats.reduce((acc, stat) => acc + stat.avgValue, 0) / hourlyStats.length)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderRiskDistribution = () => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        Distribuzione Rischi
      </Typography>
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Grafico a torta */}
        {mounted && (
          <Box sx={{ width: 400, height: 400 }}>
            <PieChart width={400} height={400}>
              <Pie
                data={riskDistribution}
                dataKey="count"
                nameKey="riskLevel"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label={({ riskLevel, percentage }) => `${riskLevel}: ${percentage.toFixed(1)}%`}
              >
                {riskDistribution.map((entry) => (
                  <Cell 
                    key={entry.riskLevel} 
                    fill={RISK_COLORS[entry.riskLevel as keyof typeof RISK_COLORS]}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [
                  `${value} pool (${(value / riskDistribution.reduce((acc, curr) => acc + curr.count, 0) * 100).toFixed(1)}%)`,
                  name
                ]}
              />
              <Legend />
            </PieChart>
          </Box>
        )}
        
        {/* Chips con percentuali */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
          {riskDistribution.map((risk) => (
            <Chip
              key={risk.riskLevel}
              label={`${risk.riskLevel}: ${risk.percentage.toFixed(1)}%`}
              sx={{
                backgroundColor: RISK_COLORS[risk.riskLevel as keyof typeof RISK_COLORS],
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Legenda Rischi:
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box component="span" sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: RISK_COLORS.Alto, mr: 1 }} />
            Alto: Mint authority o Freeze authority attivi (possibilità di rug pull)
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box component="span" sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: RISK_COLORS.Medio, mr: 1 }} />
            Medio: Metadata mutabili (possibili cambiamenti di nome/simbolo)
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            <Box component="span" sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: RISK_COLORS.Basso, mr: 1 }} />
            Basso: Contratto verificato e immutabile
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Paper sx={{ p: 3 }}>
      {renderStatistics()}
      {renderRiskDistribution()}
      
      <Typography variant="h6" gutterBottom>
        Analisi Pool di Liquidità
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell align="right">Quantità Token</TableCell>
              <TableCell align="right">SOL</TableCell>
              <TableCell align="right">Valore USD</TableCell>
              <TableCell align="right">Variazioni</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pools.map((pool) => (
              <React.Fragment key={pool.txId}>
                <TableRow
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    backgroundColor: 'background.paper',
                  }}
                >
                  <TableCell component="th" scope="row">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                        }}
                      >
                        {`${pool.tokenAccount.slice(0, 4)}...${pool.tokenAccount.slice(-4)}`}
                      </Typography>
                      <Tooltip title="Copia indirizzo" placement="top">
                        <IconButton
                          size="small"
                          onClick={() => navigator.clipboard.writeText(pool.tokenAccount)}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatNumber(pool.tokenAmount)}</TableCell>
                  <TableCell align="right">{formatNumber(pool.solanaAmount)}</TableCell>
                  <TableCell align="right">{formatUSD(pool.usdValue)}</TableCell>
                  <TableCell align="right">
                    {pool.changes && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {pool.changes.priceChangeSOL > 0 ? (
                          <TrendingUpIcon sx={{ color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ color: 'error.main' }} />
                        )}
                        <Typography
                          sx={{
                            color: getChangeColor(pool.changes.priceChangeSOL),
                            fontWeight: 'bold',
                          }}
                        >
                          {formatPercentage(pool.changes.priceChangeSOL)}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => setExpandedPool(expandedPool === pool.txId ? null : pool.txId)}
                    >
                      {expandedPool === pool.txId ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={expandedPool === pool.txId} timeout="auto" unmountOnExit>
                      {renderMetricsRow(pool)}
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default LPAnalytics;
