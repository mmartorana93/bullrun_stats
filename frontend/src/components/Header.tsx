import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

interface HeaderProps {
  address: string;
  balance: number;
  isTestWallet: boolean;
}

const Header = ({ address, balance, isTestWallet }: HeaderProps) => {
  const truncatedAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';
  const balanceText = (!address || balance === 0) 
    ? "Wallet non connesso" 
    : `${balance.toFixed(4)} SOL`;

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Solana Wallet Tracker
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '8px 16px',
            borderRadius: '8px'
          }}>
            <AccountBalanceWalletIcon />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ 
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px'
                }}>
                  {truncatedAddress || 'Non connesso'}
                </Typography>
                {isTestWallet && (
                  <Chip 
                    label="TEST" 
                    size="small" 
                    color="warning" 
                    sx={{ height: '16px' }} 
                  />
                )}
              </Box>
              <Typography variant="body1" sx={{ 
                color: (!address || balance === 0) ? 'error.main' : 'success.main',
                fontWeight: 'bold'
              }}>
                {balanceText}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
