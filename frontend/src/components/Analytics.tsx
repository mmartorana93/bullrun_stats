import React from 'react';
import { Box, Typography } from '@mui/material';
import LPAnalytics from './LPAnalytics';
import { useLPHistory } from '../hooks/useLPHistory';

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

const Analytics: React.FC = () => {
    const { hourlyStats: rawHourlyStats, calculateRiskDistribution: rawRiskDistribution } = useLPHistory();
    const [priceHistory, setPriceHistory] = React.useState<{ price: number; timestamp: number; }[]>([]);

    // Converti hourlyStats nel formato richiesto
    const formattedHourlyStats: HourlyStats[] = rawHourlyStats.map(stat => ({
        hour: new Date(stat.timestamp).getHours(),
        volume: stat.avgUsdValue * stat.totalPools,
        transactions: stat.totalPools,
        avgValue: stat.avgUsdValue
    }));

    // Converti riskDistribution nel formato richiesto
    const calculateFormattedRiskDistribution = (): RiskDistribution[] => {
        const rawDistribution = rawRiskDistribution();
        const total = rawDistribution.reduce((acc, curr) => acc + curr.value, 0);

        return [
            {
                riskLevel: 'Basso',
                count: rawDistribution.find(d => d.id === 'safe')?.value || 0,
                percentage: (rawDistribution.find(d => d.id === 'safe')?.value || 0) / total * 100
            },
            {
                riskLevel: 'Medio',
                count: rawDistribution.find(d => d.id === 'mutableMetadata')?.value || 0,
                percentage: (rawDistribution.find(d => d.id === 'mutableMetadata')?.value || 0) / total * 100
            },
            {
                riskLevel: 'Alto',
                count: (
                    (rawDistribution.find(d => d.id === 'freezeAuthority')?.value || 0) +
                    (rawDistribution.find(d => d.id === 'mintAuthority')?.value || 0)
                ),
                percentage: (
                    (rawDistribution.find(d => d.id === 'freezeAuthority')?.value || 0) +
                    (rawDistribution.find(d => d.id === 'mintAuthority')?.value || 0)
                ) / total * 100
            }
        ];
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Analytics Dashboard
            </Typography>
            
            <LPAnalytics 
                priceHistory={priceHistory}
                hourlyStats={formattedHourlyStats}
                riskDistribution={calculateFormattedRiskDistribution()}
            />
        </Box>
    );
};

export default Analytics;
