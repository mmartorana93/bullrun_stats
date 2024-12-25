import React from 'react';
import { Box } from '@mui/material';
import BullRunStats from './components/BullRunStats';

const App: React.FC = () => {
  return (
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    }}>
      <BullRunStats />
    </Box>
  );
};

export default App;
