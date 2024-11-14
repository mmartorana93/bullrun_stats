import { create } from 'zustand'
import { Connection, PublicKey } from '@solana/web3.js'
import { devtools } from 'zustand/middleware'

interface Transaction {
  signature: string
  timestamp: number
  wallet: string
  tokenAddress: string
  tokenSymbol: string
  type: 'BUY' | 'SELL'
  amount: number
  age: number
}

interface WalletTrackerState {
  transactions: Transaction[]
  isConnected: boolean
  processedSignatures: Set<string>
  connection: Connection | null
  addTransaction: (tx: Transaction) => void
  setConnection: (conn: Connection) => void
  setIsConnected: (status: boolean) => void
}

export const useWalletTrackerStore = create<WalletTrackerState>()(
  devtools(
    (set) => ({
      transactions: [],
      isConnected: false,
      processedSignatures: new Set(),
      connection: null,
      addTransaction: (tx) => set((state) => ({ 
        transactions: [tx, ...state.transactions].slice(0, 100) // Keep last 100 txs
      })),
      setConnection: (conn) => set({ connection: conn }),
      setIsConnected: (status) => set({ isConnected: status }),
    })
  )
) 