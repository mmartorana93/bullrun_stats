import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

interface HeaderProps {
  address: string;
  balance: number;
  solPrice: number | null;
}

const Header = ({ address, balance, solPrice }: HeaderProps) => {
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
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '8px 16px',
            borderRadius: '8px',
            minWidth: '120px',
            textAlign: 'center'
          }}>
            <Typography variant="body2" sx={{ 
              fontWeight: 'bold',
              color: solPrice && solPrice > 0 ? 'success.main' : 'text.primary'
            }}>
              SOL: {solPrice && solPrice > 0 ? `$${solPrice.toFixed(2)}` : '...'}
            </Typography>
          </Box>
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
              <Typography variant="body2" sx={{ 
                fontFamily: 'monospace',
                letterSpacing: '0.5px'
              }}>
                {truncatedAddress || 'Non connesso'}
              </Typography>
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
