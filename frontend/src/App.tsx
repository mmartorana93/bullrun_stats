import React from 'react';
import { Box, Container } from '@mui/material';
import BullRunStats from './components/BullRunStats';

const App: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <BullRunStats />
      </Box>
    </Container>
  );
};

export default App;
