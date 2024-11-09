import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { format } from 'date-fns';
import { Box, Paper, Typography, Grid } from '@mui/material';

interface PriceData {
    price: number;
    timestamp: number;
}

interface HourlyStats {
    timestamp: string;
    totalPools: number;
    safePools: number;
    riskyPools: number;
    avgUsdValue: number;
}

interface RiskDistribution {
    id: string;
    label: string;
    value: number;
    color: string;
}

interface LPAnalyticsProps {
    priceHistory: PriceData[];
    hourlyStats: HourlyStats[];
    riskDistribution: RiskDistribution[];
}

const LPAnalytics: React.FC<LPAnalyticsProps> = ({
    priceHistory,
    hourlyStats,
    riskDistribution
}) => {
    const priceData = [{
        id: 'token_price',
        data: priceHistory.map(point => ({
            x: format(point.timestamp, 'HH:mm'),
            y: point.price
        }))
    }];

    const barData = hourlyStats.map(stat => ({
        hour: format(new Date(stat.timestamp), 'HH:mm'),
        'Pool Totali': stat.totalPools,
        'Pool Sicure': stat.safePools,
        'Pool Rischiose': stat.riskyPools,
        'Valore Medio USD': stat.avgUsdValue
    }));

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
                Analisi Pool di Liquidità
            </Typography>
            
            <Grid container spacing={3}>
                {/* Grafico Prezzi */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 300 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Andamento Prezzi
                        </Typography>
                        <Box sx={{ height: 250 }}>
                            <ResponsiveLine
                                data={priceData}
                                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                xScale={{ type: 'point' }}
                                yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                                axisBottom={{
                                    tickSize: 5,
                                    tickRotation: -45
                                }}
                                axisLeft={{
                                    tickSize: 5,
                                    tickRotation: 0,
                                    legend: 'Prezzo',
                                    legendOffset: -40,
                                    legendPosition: 'middle'
                                }}
                                enablePoints={false}
                                enableGridX={false}
                                curve="monotoneX"
                                animate={true}
                                theme={{
                                    axis: {
                                        ticks: {
                                            text: {
                                                fontSize: 11
                                            }
                                        }
                                    }
                                }}
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Statistiche Orarie */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 300 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Statistiche Orarie
                        </Typography>
                        <Box sx={{ height: 250 }}>
                            <ResponsiveBar
                                data={barData}
                                keys={['Pool Totali', 'Pool Sicure', 'Pool Rischiose']}
                                indexBy="hour"
                                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                padding={0.3}
                                groupMode="grouped"
                                axisBottom={{
                                    tickSize: 5,
                                    tickRotation: -45
                                }}
                                axisLeft={{
                                    tickSize: 5,
                                    tickRotation: 0,
                                    legend: 'Numero di Pool',
                                    legendOffset: -40,
                                    legendPosition: 'middle'
                                }}
                                theme={{
                                    axis: {
                                        ticks: {
                                            text: {
                                                fontSize: 11
                                            }
                                        }
                                    }
                                }}
                                colors={{ scheme: 'nivo' }}
                                animate={true}
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Distribuzione Rischi */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 300 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Distribuzione Rischi
                        </Typography>
                        <Box sx={{ height: 250 }}>
                            <ResponsivePie
                                data={riskDistribution}
                                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                                innerRadius={0.5}
                                padAngle={0.7}
                                cornerRadius={3}
                                activeOuterRadiusOffset={8}
                                colors={{ scheme: 'nivo' }}
                                borderWidth={1}
                                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor="#333333"
                                arcLinkLabelsThickness={2}
                                arcLinkLabelsColor={{ from: 'color' }}
                                arcLabelsSkipAngle={10}
                                arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                                animate={true}
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default LPAnalytics;
