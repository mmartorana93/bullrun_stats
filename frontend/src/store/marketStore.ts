import { create } from 'zustand'

interface MarketState {
  btcDominance: number | null
  btcPrice: number | null
  total2: number | null
  total3: number | null
  usdtDominance: number | null
  total: number | null
  updateBtcDominance: (value: number) => void
  updateBtcPrice: (value: number) => void
  updateTotal2: (value: number) => void
  updateTotal3: (value: number) => void
  updateUsdtDominance: (value: number) => void
  updateTotal: (value: number) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  btcDominance: null,
  btcPrice: null,
  total2: null,
  total3: null,
  usdtDominance: null,
  total: null,
  updateBtcDominance: (value: number) => {
    console.log('Aggiornamento BTC Dominance:', value);
    set({ btcDominance: value });
  },
  updateBtcPrice: (value: number) => {
    console.log('Aggiornamento BTC Price:', value);
    set({ btcPrice: value });
  },
  updateTotal2: (value: number) => {
    console.log('Aggiornamento Total2:', value);
    set({ total2: value });
  },
  updateTotal3: (value: number) => {
    console.log('Aggiornamento Total3:', value);
    set({ total3: value });
  },
  updateUsdtDominance: (value: number) => {
    console.log('Aggiornamento USDT Dominance:', value);
    set({ usdtDominance: value });
  },
  updateTotal: (value: number) => {
    console.log('Aggiornamento Total:', value);
    set({ total: value });
  },
}))
