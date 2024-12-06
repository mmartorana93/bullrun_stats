export const TRADING_CONSTANTS = {
  SOL_ADDRESS: "So11111111111111111111111111111111111111112",
  
  PRIORITY_FEES: {
    ULTRA: 5000,  // Ultra veloce per sniping
    HIGH: 2000,   // Veloce
    MEDIUM: 1000, // Standard
    LOW: 500      // Economico
  },

  SLIPPAGE_PRESETS: {
    ULTRA: 1000,  // 10% per sniping ultra veloce
    FAST: 500,    // 5% per trade veloci
    MEDIUM: 200,  // 2% standard
    SAFE: 100     // 1% sicuro
  },

  PRESET_BUY_AMOUNTS: [0.01, 0.02, 0.04, 0.08, 0.16, 0.32],
  PRESET_SELL_PERCENTAGES: [25, 50, 75, 100],

  // Preset configurazioni per diversi tipi di trade
  TRADE_PRESETS: {
    SNIPE: {
      slippageBps: 1000,  // 10%
      priorityFee: 5000,
      skipPreflight: true,
      maxRetries: 5
    },
    FAST: {
      slippageBps: 500,   // 5%
      priorityFee: 2000,
      skipPreflight: true,
      maxRetries: 3
    },
    NORMAL: {
      slippageBps: 200,   // 2%
      priorityFee: 1000,
      skipPreflight: false,
      maxRetries: 2
    }
  }
}; 