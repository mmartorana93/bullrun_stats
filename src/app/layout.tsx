import { WalletTracker } from '@/services/walletTracker'

const WALLETS = [
  "GgDGFZzrweSj3yRQUQnDpnmPFMP3zK54Pzogm4WF3GW1",
  // ... altri wallet
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const tracker = new WalletTracker(
      "https://api.mainnet-beta.solana.com",
      WALLETS
    )
    
    tracker.subscribeToWallets()
  }, [])

  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
} 