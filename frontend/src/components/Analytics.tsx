import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const Analytics: React.FC = () => {
    return (
        <Box sx={{ width: '100%', p: 2 }}>
            <Typography variant="h6" component="div" gutterBottom>
                Analytics
            </Typography>
            <Paper sx={{ p: 3, minHeight: '400px' }}>
                <Typography variant="body1" color="textSecondary" align="center">
                    Grafici e indicatori in arrivo...
                </Typography>
            </Paper>
        </Box>
    );
};

export default Analytics;
