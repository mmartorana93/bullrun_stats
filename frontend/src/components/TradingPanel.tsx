import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { walletService, type WalletInfo } from '../services/walletService';
import { tradingService } from '../services/tradingService';
import { TRADING_CONSTANTS } from '../lib/constants/trading';
import { AxiosError } from 'axios';

type TradingMode = 'buy' | 'sell';

interface TradingPanelProps {
  className?: string;
  mode: 'manual' | 'sniper';
}

interface TradingParams {
  mode: TradingMode;
  amount: string;
  slippage: string;
  tokenAddress: string;
}

interface SwapBaseParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  isInputSol: boolean;
  isOutputSol: boolean;
}

interface OptimizedSwapParams extends SwapBaseParams {
  slippageBps: number;
  priorityFee: number;
  skipPreflight: boolean;
  maxRetries: number;
  computeUnitPriceMicroLamports: number;
  wrapSol: boolean;
  unwrapSol: boolean;
}

interface QuoteInfo {
  inAmount: string;
  outAmount: string;
  priceImpactPct: number | string;
}

const DEFAULT_PARAMS: TradingParams = {
  mode: 'buy',
  amount: '',
  slippage: '2.0',
  tokenAddress: ''
};

export const TradingPanel: React.FC<TradingPanelProps> = ({ className, mode }) => {
  const [params, setParams] = useState<TradingParams>(DEFAULT_PARAMS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [quote, setQuote] = useState<QuoteInfo | null>(null);
  const [tradeSpeed, setTradeSpeed] = useState<'SNIPE' | 'FAST' | 'NORMAL'>('NORMAL');

  useEffect(() => {
    loadWallet();
  }, []);

  useEffect(() => {
    if (params.amount && params.tokenAddress) {
      getQuote();
    }
  }, [params.amount, params.tokenAddress, params.mode]);

  const loadWallet = async () => {
    try {
      const walletInfo = await walletService.getMyWallet();
      console.log('Wallet caricato:', walletInfo);
      setWallet(walletInfo);
    } catch (error) {
      console.error('Errore nel caricamento del wallet:', error);
      setError('Errore nel caricamento del wallet');
    }
  };

  const handleModeChange = (mode: TradingMode) => {
    setParams(prev => ({ ...prev, mode }));
    setQuote(null);
  };

  const handleAmountChange = (amount: string) => {
    setParams(prev => ({ ...prev, amount }));
  };

  const handleParamChange = (key: keyof TradingParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const getQuote = async () => {
    if (!params.tokenAddress || !params.amount) return;

    try {
      const amount = parseFloat(params.amount);
      if (isNaN(amount)) return;

      const inputMint = params.mode === 'buy' ? TRADING_CONSTANTS.SOL_ADDRESS : params.tokenAddress;
      const outputMint = params.mode === 'buy' ? params.tokenAddress : TRADING_CONSTANTS.SOL_ADDRESS;

      console.log('[TradingPanel] Richiesta quotazione:', {
        mode: params.mode,
        inputMint,
        outputMint,
        amount,
        isInputSol: inputMint === TRADING_CONSTANTS.SOL_ADDRESS
      });

      const quoteResponse = await tradingService.getQuote(inputMint, outputMint, amount);
      console.log('[TradingPanel] Risposta quotazione:', quoteResponse);
      
      if (quoteResponse.success && quoteResponse.data) {
        console.log('[TradingPanel] Quote data:', {
          inAmount: quoteResponse.data.inAmount,
          outAmount: quoteResponse.data.outAmount,
          priceImpact: quoteResponse.data.priceImpact
        });
        
        setQuote({
          inAmount: quoteResponse.data.inAmount,
          outAmount: quoteResponse.data.outAmount,
          priceImpactPct: quoteResponse.data.priceImpact || 0
        });
        setError(null);
      } else {
        console.error('[TradingPanel] Errore quotazione:', quoteResponse.error);
        setError(quoteResponse.error || 'Errore nel recupero della quotazione');
        setQuote(null);
      }
    } catch (error) {
      console.error('[TradingPanel] Errore catch quotazione:', error);
      if (error instanceof AxiosError && error.response) {
        console.error('[TradingPanel] Response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      setError('Errore nel recupero della quotazione');
      setQuote(null);
    }
  };

  const getOptimizedParams = (baseParams: SwapBaseParams): OptimizedSwapParams => {
    const preset = TRADING_CONSTANTS.TRADE_PRESETS[tradeSpeed];
    
    return {
      ...baseParams,
      amount: baseParams.isInputSol ? 
        Math.floor(baseParams.amount * 1e9) : 
        baseParams.amount,
      slippageBps: Math.floor(parseFloat(params.slippage) * 100),
      priorityFee: preset.priorityFee,
      skipPreflight: preset.skipPreflight,
      maxRetries: preset.maxRetries,
      computeUnitPriceMicroLamports: preset.priorityFee,
      wrapSol: baseParams.isInputSol,
      unwrapSol: baseParams.isOutputSol
    };
  };

  const handleSubmit = async () => {
    if (!params.tokenAddress || !params.amount || !params.slippage || !wallet) {
      setError('Per favore compila tutti i campi richiesti');
      return;
    }

    const numAmount = parseFloat(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Inserisci un importo valido');
      return;
    }

    if (params.mode === 'buy' && wallet && numAmount > wallet.balance) {
      setError('Importo superiore al balance disponibile');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const inputMint = params.mode === 'buy' ? TRADING_CONSTANTS.SOL_ADDRESS : params.tokenAddress;
      const outputMint = params.mode === 'buy' ? params.tokenAddress : TRADING_CONSTANTS.SOL_ADDRESS;
      const isInputSol = inputMint === TRADING_CONSTANTS.SOL_ADDRESS;
      const isOutputSol = outputMint === TRADING_CONSTANTS.SOL_ADDRESS;

      const baseParams: SwapBaseParams = {
        inputMint,
        outputMint,
        amount: numAmount,
        isInputSol,
        isOutputSol
      };

      const optimizedParams = getOptimizedParams(baseParams);

      console.log('Parametri ottimizzati di swap:', optimizedParams);

      const result = await tradingService.executeSwap(optimizedParams);

      if (result.success) {
        console.log('Transazione completata:', result.transactionHash);
        await loadWallet();
      } else {
        setError(result.error || 'Errore durante lo swap');
      }
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

  const formatPriceImpact = (impact: number | string): string => {
    if (typeof impact === 'number') {
      return impact.toFixed(2);
    }
    return '0.00';
  };

  return (
    <div className={cn("w-[320px] bg-[#1a1b1f] rounded-lg p-4 text-white", className)}>
      {/* Trading Mode Tabs */}
      <div className="flex mb-2 bg-[#2c2d33] rounded-lg p-1">
        <button
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium",
            params.mode === 'buy' 
              ? "bg-[#4c82fb] text-white" 
              : "text-gray-400 hover:text-white"
          )}
          onClick={() => handleModeChange('buy')}
        >
          {mode === 'sniper' ? '⚡ Snipe' : '⚡ Buy'}
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
          �� Sell
        </button>
      </div>

      {/* Quick Trade Buttons - Spostati qui */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        <Button
          variant="destructive"
          onClick={() => {
            setTradeSpeed('SNIPE');
            handleParamChange('slippage', (TRADING_CONSTANTS.TRADE_PRESETS.SNIPE.slippageBps / 100).toString());
          }}
          className={cn(
            "bg-red-600 hover:bg-red-700 px-2 h-8 text-xs",
            tradeSpeed === 'SNIPE' && "ring-2 ring-red-400"
          )}
        >
          <div className="flex items-center justify-center space-x-1">
            <span>🚀</span>
            <span>Snipe</span>
          </div>
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setTradeSpeed('FAST');
            handleParamChange('slippage', (TRADING_CONSTANTS.TRADE_PRESETS.FAST.slippageBps / 100).toString());
          }}
          className={cn(
            "bg-yellow-600 hover:bg-yellow-700 px-2 h-8 text-xs",
            tradeSpeed === 'FAST' && "ring-2 ring-yellow-400"
          )}
        >
          <div className="flex items-center justify-center space-x-1">
            <span>⚡</span>
            <span>Fast</span>
          </div>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setTradeSpeed('NORMAL');
            handleParamChange('slippage', (TRADING_CONSTANTS.TRADE_PRESETS.NORMAL.slippageBps / 100).toString());
          }}
          className={cn(
            "bg-blue-900 hover:bg-blue-800 text-white px-2 h-8 text-xs",
            tradeSpeed === 'NORMAL' && "ring-2 ring-blue-400"
          )}
        >
          <div className="flex items-center justify-center space-x-1">
            <span>🔄</span>
            <span>Normal</span>
          </div>
        </Button>
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
          {TRADING_CONSTANTS.PRESET_BUY_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="bg-[#2c2d33] hover:bg-[#3c3d43]"
              onClick={() => handleAmountChange(amount.toString())}
              disabled={!wallet || amount > wallet.balance}
            >
              {amount < 0.1 ? amount.toFixed(3) : amount.toFixed(2)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex space-x-2 mb-4">
          {TRADING_CONSTANTS.PRESET_SELL_PERCENTAGES.map((percentage) => (
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

      {/* Quote Info */}
      {quote && (
        <div className="mb-4 p-2 bg-[#2c2d33] rounded-lg text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Expected Output:</span>
            <span>{quote.outAmount} {params.mode === 'buy' ? 'tokens' : 'SOL'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price Impact:</span>
            <span className={cn(
              parseFloat(formatPriceImpact(quote.priceImpactPct)) > 5 ? "text-red-500" : "text-green-500"
            )}>
              {formatPriceImpact(quote.priceImpactPct)}%
            </span>
          </div>
        </div>
      )}

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

      {/* Wallet Info */}
      {wallet && (
        <div className="mb-4 p-2 bg-[#2c2d33] rounded-lg text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Wallet:</span>
            <span className="text-xs">{`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Balance:</span>
            <span>{wallet.balance.toFixed(4)} SOL</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/20 text-red-500 rounded text-sm">
          {error}
        </div>
      )}

      {/* Trade Speed Info - Mantenuto */}
      <div className="mb-4 p-2 bg-[#2c2d33] rounded-lg text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-gray-400">Mode:</span>
          <span className={cn(
            tradeSpeed === 'SNIPE' && "text-red-400",
            tradeSpeed === 'FAST' && "text-yellow-400",
            tradeSpeed === 'NORMAL' && "text-blue-400"
          )}>
            {tradeSpeed}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Slippage:</span>
          <span>{params.slippage}%</span>
        </div>
      </div>

      {/* Action Button */}
      <Button 
        className="w-full bg-[#4c82fb] hover:bg-[#3b71ea] text-white py-3 rounded-lg text-sm font-medium"
        onClick={handleSubmit}
        disabled={isLoading || !params.tokenAddress || !params.amount || !params.slippage || !wallet}
      >
        {isLoading ? 'Processing...' : mode === 'sniper' ? 'Quick Snipe' : `Quick ${params.mode === 'buy' ? 'Buy' : 'Sell'}`}
      </Button>
    </div>
  );
};

export default TradingPanel;
