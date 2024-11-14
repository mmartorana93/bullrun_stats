import { useWalletTrackerStore } from '@/store/useWalletTrackerStore'
import { formatDistanceToNow } from 'date-fns'

export const TransactionsList = () => {
  const { transactions } = useWalletTrackerStore()

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div 
          key={tx.signature}
          className="p-4 rounded-lg border border-border bg-card"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                {tx.wallet.slice(0,4)}...{tx.wallet.slice(-4)}
              </p>
              <p className="font-medium">
                {tx.type}: {tx.amount} SOL
              </p>
              <p className="text-sm">
                Token: {tx.tokenSymbol}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(tx.timestamp)} ago
              </p>
              <p className="text-sm">
                Age: {tx.age}s
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 