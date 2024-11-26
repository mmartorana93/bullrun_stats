import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface TradingPanelProps {
  className?: string;
  mode?: 'manual' | 'sniper'; // manteniamo retrocompatibilità
}

type TradingMode = 'buy' | 'sell';
type WalletId = 'S1' | 'S2' | 'S3';
type SpeedMode = 'default' | 'auto';

interface TradingParams {
  mode: TradingMode;
  selectedWallets: WalletId[];
  amount: string;
  slippage: number;
  smartMevProtection: boolean;
  speed: SpeedMode;
  priorityFee: number;
  briberyAmount: number;
}

const DEFAULT_PARAMS: TradingParams = {
  mode: 'buy',
  selectedWallets: ['S1'],
  amount: '',
  slippage: 20.0,
  smartMevProtection: true,
  speed: 'default',
  priorityFee: 0.008,
  briberyAmount: 0.012,
};

const PRESET_BUY_AMOUNTS = [0.25, 0.5, 1, 2, 5, 10];
const PRESET_SELL_PERCENTAGES = [25, 50, 100];

export const TradingPanel: React.FC<TradingPanelProps> = ({ className, mode: tradingMode }) => {
  const [params, setParams] = useState<TradingParams>(DEFAULT_PARAMS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleModeChange = (mode: TradingMode) => {
    setParams(prev => ({ ...prev, mode }));
  };

  const handleWalletToggle = (wallet: WalletId) => {
    setParams(prev => ({
      ...prev,
      selectedWallets: prev.selectedWallets.includes(wallet)
        ? prev.selectedWallets.filter(w => w !== wallet)
        : [...prev.selectedWallets, wallet]
    }));
  };

  const handlePresetAmount = (amount: number) => {
    setParams(prev => ({ ...prev, amount: amount.toString() }));
  };

  const handlePresetPercentage = (percentage: number) => {
    // In un'implementazione reale, calcolerebbe l'importo basato sul saldo
    setParams(prev => ({ ...prev, amount: `${percentage}%` }));
  };

  return (
    <div className={cn("w-[320px] bg-[#1a1b1f] rounded-lg p-4", className)}>
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

      {/* Trading Type */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <div className="h-2 w-2 bg-[#4c82fb] rounded-full"></div>
          <span className="text-white text-sm">
            {params.mode === 'buy' ? 'Buy Now' : 'Sell Now'}
          </span>
        </div>
      </div>

      {/* Wallet Selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button className="flex items-center space-x-2 text-white text-sm bg-[#2c2d33] px-3 py-2 rounded-lg">
            <span>Select wallets</span>
            <span className="text-xs">▼</span>
          </button>
          <div className="flex space-x-2">
            {['S1', 'S2', 'S3'].map((wallet) => (
              <button
                key={wallet}
                className={cn(
                  "px-3 py-1 rounded-lg text-sm",
                  params.selectedWallets.includes(wallet as WalletId)
                    ? "bg-[#4c82fb] text-white"
                    : "bg-[#2c2d33] text-gray-400"
                )}
                onClick={() => handleWalletToggle(wallet as WalletId)}
              >
                {wallet}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Amount Selection */}
      {params.mode === 'buy' ? (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESET_BUY_AMOUNTS.map((amount) => (
            <button
              key={amount}
              className="bg-[#2c2d33] text-white text-sm py-2 rounded-lg hover:bg-[#3c3d43]"
              onClick={() => handlePresetAmount(amount)}
            >
              = {amount}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex space-x-2 mb-4">
          {PRESET_SELL_PERCENTAGES.map((percentage) => (
            <button
              key={percentage}
              className="flex-1 bg-[#2c2d33] text-white text-sm py-2 rounded-lg hover:bg-[#3c3d43]"
              onClick={() => handlePresetPercentage(percentage)}
            >
              {percentage}%
            </button>
          ))}
        </div>
      )}

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center bg-[#2c2d33] rounded-lg p-2">
          <select className="bg-transparent text-white text-sm px-2">
            <option value="SOL">SOL</option>
          </select>
          <input
            type="text"
            className="flex-1 bg-transparent text-white text-sm px-2 outline-none"
            placeholder={`Amount to ${params.mode} in SOL`}
            value={params.amount}
            onChange={(e) => setParams(prev => ({ ...prev, amount: e.target.value }))}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="mb-4">
        <button
          className="flex items-center space-x-2 text-white text-sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span className="text-gray-400">⚙️ Advanced Settings</span>
          <span className="text-red-500">⚠ Warning</span>
          <span>{showAdvanced ? '▼' : '▲'}</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Slippage */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Slippage %</span>
                <div className="flex items-center space-x-2">
                  <span className="text-white">{params.slippage}</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-400">Smart-Mev protection</span>
                    <button
                      className={cn(
                        "px-2 py-1 rounded text-xs",
                        params.smartMevProtection ? "bg-green-500" : "bg-gray-500"
                      )}
                      onClick={() => setParams(prev => ({ 
                        ...prev, 
                        smartMevProtection: !prev.smartMevProtection 
                      }))}
                    >
                      {params.smartMevProtection ? 'Fast' : 'Secure'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Set Speed */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Set Speed</span>
                <span>ℹ️</span>
              </div>
              <div className="flex space-x-2">
                <button
                  className={cn(
                    "flex-1 py-1 rounded-lg text-sm",
                    params.speed === 'default'
                      ? "bg-[#4c82fb] text-white"
                      : "bg-[#2c2d33] text-gray-400"
                  )}
                  onClick={() => setParams(prev => ({ ...prev, speed: 'default' }))}
                >
                  Default
                </button>
                <button
                  className={cn(
                    "flex-1 py-1 rounded-lg text-sm",
                    params.speed === 'auto'
                      ? "bg-[#4c82fb] text-white"
                      : "bg-[#2c2d33] text-gray-400"
                  )}
                  onClick={() => setParams(prev => ({ ...prev, speed: 'auto' }))}
                >
                  Auto
                </button>
              </div>
            </div>

            {/* Priority Fee */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Priority Fee</span>
                <span>{params.priorityFee} SOL</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={params.priorityFee}
                onChange={(e) => setParams(prev => ({ 
                  ...prev, 
                  priorityFee: parseFloat(e.target.value) 
                }))}
                className="w-full"
              />
            </div>

            {/* Bribery Amount */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Bribery Amount</span>
                <span>{params.briberyAmount} SOL</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={params.briberyAmount}
                onChange={(e) => setParams(prev => ({ 
                  ...prev, 
                  briberyAmount: parseFloat(e.target.value) 
                }))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button className="w-full bg-[#4c82fb] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#3b71ea]">
        Quick {params.mode === 'buy' ? 'Buy' : 'Sell'}
      </button>

      {/* Warning Text */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        {params.mode === 'buy' 
          ? "Once you click on Quick Buy, your transaction is sent immediately."
          : "Estimation of expected payout incl. price impact and fees is only enabled for Raydium AMM. Once you click on Quick Sell, your transaction is sent immediately."}
      </p>
    </div>
  );
};

export default TradingPanel;
