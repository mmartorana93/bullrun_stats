import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { walletService, type WalletInfo } from '../services/walletService';

type TradingMode = 'buy' | 'sell';

interface TradingPanelProps {
  className?: string;
}

interface TradingParams {
  mode: TradingMode;
  amount: string;
  slippage: string;
  tokenAddress: string;
}

const DEFAULT_PARAMS: TradingParams = {
  mode: 'buy',
  amount: '',
  slippage: '1.0', // Default slippage 1%
  tokenAddress: ''
};

const PRESET_BUY_AMOUNTS = [0.25, 0.5, 1, 2, 5, 10];
const PRESET_SELL_PERCENTAGES = [25, 50, 100];
const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

export const TradingPanel: React.FC<TradingPanelProps> = ({ className }) => {
  const [params, setParams] = useState<TradingParams>(DEFAULT_PARAMS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const walletInfo = await walletService.getMyWallet();
      setWallet(walletInfo);
    } catch (error) {
      console.error('Errore nel caricamento del wallet:', error);
      setError('Errore nel caricamento del wallet');
    }
  };

  const handleModeChange = (mode: TradingMode) => {
    setParams(prev => ({ ...prev, mode }));
  };

  const handleAmountChange = (amount: string) => {
    setParams(prev => ({ ...prev, amount }));
  };

  const handleParamChange = (key: keyof TradingParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!params.tokenAddress || !params.amount || !params.slippage) {
      setError('Per favore compila tutti i campi richiesti');
      return;
    }

    if (!wallet) {
      setError('Wallet non disponibile');
      return;
    }

    // Validazione dell'importo prima del submit
    const numAmount = parseFloat(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Inserisci un importo valido');
      return;
    }
    if (wallet && numAmount > wallet.balance) {
      setError('Importo superiore al balance disponibile');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implementare la logica di trading diretta con Jupiter SDK
      console.log('Trading non ancora implementato');
      setError('Funzionalità in sviluppo');
    } catch (error) {
      console.error('Errore durante lo swap:', error);
      setError(error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const validateSlippage = (value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0 || numValue > 100) {
      setError('Lo slippage deve essere tra 0 e 100');
      return false;
    }
    return true;
  };

  return (
    <div className={cn("w-[320px] bg-[#1a1b1f] rounded-lg p-4 text-white", className)}>
      {/* Trading Mode Tabs */}
      <div className="flex mb-4 bg-[#2c2d33] rounded-lg p-1">
        <button
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium",
            params.mode === 'buy' 
              ? "bg-[#4c82fb] text-white" 
              : "text-gray-400 hover:text-white"
          )}
          onClick={() => handleModeChange('buy')}
        >
          ⚡ Buy
        </button>
        <button
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium",
            params.mode === 'sell'
              ? "bg-[#4c82fb] text-white"
              : "text-gray-400 hover:text-white"
          )}
          onClick={() => handleModeChange('sell')}
        >
          🔄 Sell
        </button>
      </div>

      {/* Token Input */}
      <div className="mb-4">
        <div className="flex items-center bg-[#2c2d33] rounded-lg p-2">
          <Input
            type="text"
            placeholder="Token Address"
            className="flex-1 bg-transparent text-white text-sm px-2 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={params.tokenAddress}
            onChange={(e) => handleParamChange('tokenAddress', e.target.value)}
          />
        </div>
      </div>

      {/* Amount Selection */}
      {params.mode === 'buy' ? (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESET_BUY_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="bg-[#2c2d33] hover:bg-[#3c3d43]"
              onClick={() => handleAmountChange(amount.toString())}
              disabled={!wallet || amount > wallet.balance}
            >
              {amount}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex space-x-2 mb-4">
          {PRESET_SELL_PERCENTAGES.map((percentage) => (
            <Button
              key={percentage}
              variant="outline"
              className="flex-1 bg-[#2c2d33] hover:bg-[#3c3d43]"
              onClick={() => handleAmountChange(`${percentage}%`)}
            >
              {percentage}%
            </Button>
          ))}
        </div>
      )}

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center bg-[#2c2d33] rounded-lg p-2">
          <span className="text-white text-sm px-2">SOL</span>
          <Input
            type="text"
            className="flex-1 bg-transparent text-white text-sm px-2 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={`Amount to ${params.mode} in SOL`}
            value={params.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
          />
        </div>
      </div>

      {/* Slippage Input */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Slippage %</span>
          <Input
            type="text"
            className="w-20 bg-[#2c2d33] text-white text-sm px-2 py-1 h-8"
            value={params.slippage}
            onChange={(e) => {
              if (validateSlippage(e.target.value)) {
                handleParamChange('slippage', e.target.value);
              }
            }}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/20 text-red-500 rounded text-sm">
          {error}
        </div>
      )}

      {/* Action Button */}
      <Button 
        className="w-full bg-[#4c82fb] hover:bg-[#3b71ea] text-white py-3 rounded-lg text-sm font-medium"
        onClick={handleSubmit}
        disabled={isLoading || !params.tokenAddress || !params.amount || !params.slippage || !wallet}
      >
        {isLoading ? 'Processing...' : `Quick ${params.mode === 'buy' ? 'Buy' : 'Sell'}`}
      </Button>
    </div>
  );
};

export default TradingPanel;
