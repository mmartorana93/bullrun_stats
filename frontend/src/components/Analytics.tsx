import React from 'react';
import { Box, Typography } from '@mui/material';
import LPAnalytics from './LPAnalytics';
import { useLPHistory } from '../hooks/useLPHistory';

const Analytics: React.FC = () => {
    const { hourlyStats, calculateRiskDistribution } = useLPHistory();
    const [priceHistory, setPriceHistory] = React.useState<{ price: number; timestamp: number; }[]>([]);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Analytics Dashboard
            </Typography>
            
            <LPAnalytics 
                priceHistory={priceHistory}
                hourlyStats={hourlyStats}
                riskDistribution={calculateRiskDistribution()}
            />
        </Box>
    );
};

export default Analytics;
