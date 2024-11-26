import React, { useState } from 'react';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';

type TradingMode = 'buy' | 'sell';
type SpeedMode = 'default' | 'auto';

interface TradingPanelProps {
  className?: string;
  mode?: 'manual' | 'sniper';
}

interface TradingParams {
  mode: TradingMode;
  instantMode: boolean;
  amount: string;
  slippage: string;
  smartMevProtection: boolean;
  speed: SpeedMode;
  priorityFee: string;
  briberyAmount: string;
}

const DEFAULT_PARAMS: TradingParams = {
  mode: 'buy',
  instantMode: false,
  amount: '',
  slippage: '20.0',
  smartMevProtection: true,
  speed: 'default',
  priorityFee: '0.008',
  briberyAmount: '0.012',
};

const PRESET_BUY_AMOUNTS = [0.25, 0.5, 1, 2, 5, 10];
const PRESET_SELL_PERCENTAGES = [25, 50, 100];

export const TradingPanel: React.FC<TradingPanelProps> = ({ className, mode = 'manual' }) => {
  const [params, setParams] = useState<TradingParams>(DEFAULT_PARAMS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleModeChange = (mode: TradingMode) => {
    setParams(prev => ({ ...prev, mode }));
  };

  const handleAmountChange = (amount: string) => {
    setParams(prev => ({ ...prev, amount }));
  };

  const handleAdvancedSettingChange = (key: keyof TradingParams, value: string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
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

      {/* Trading Type */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" className="flex-1 justify-start">
            {params.mode === 'buy' ? 'Buy Now' : 'Sell Now'}
          </Button>
          <Button variant="ghost" className="flex-1 justify-start">
            {params.mode === 'buy' ? 'Buy Dip' : 'Auto Sell'}
          </Button>
          <div className="flex items-center space-x-2">
            <Switch
              checked={params.instantMode}
              onCheckedChange={(checked: boolean) => handleAdvancedSettingChange('instantMode', checked)}
            />
            <Label>Insta {params.mode === 'buy' ? 'Buy' : 'Sell'}</Label>
          </div>
        </div>
      </div>

      {/* Wallet Selection */}
      <div className="mb-4">
        <Select>
          <SelectTrigger className="w-full bg-[#2c2d33]">
            <SelectValue placeholder="Select wallet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wallet1">Wallet 1</SelectItem>
            <SelectItem value="wallet2">Wallet 2</SelectItem>
            <SelectItem value="wallet3">Wallet 3</SelectItem>
          </SelectContent>
        </Select>
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
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Slippage %</span>
                <Input
                  type="text"
                  className="w-20 bg-[#2c2d33] text-white text-sm px-2 py-1 h-8"
                  value={params.slippage}
                  onChange={(e) => handleAdvancedSettingChange('slippage', e.target.value)}
                />
              </div>
            </div>

            {/* Smart-Mev Protection */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Smart-Mev protection</span>
              <Switch
                checked={params.smartMevProtection}
                onCheckedChange={(checked: boolean) => handleAdvancedSettingChange('smartMevProtection', checked)}
              />
            </div>

            {/* Set Speed */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Set Speed</span>
                <span>ℹ️</span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant={params.speed === 'default' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => handleAdvancedSettingChange('speed', 'default')}
                >
                  Default
                </Button>
                <Button
                  variant={params.speed === 'auto' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => handleAdvancedSettingChange('speed', 'auto')}
                >
                  Auto
                </Button>
              </div>
            </div>

            {/* Priority Fee */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Priority Fee</span>
                <Input
                  type="text"
                  className="w-24 bg-[#2c2d33] text-white text-sm px-2 py-1 h-8"
                  value={params.priorityFee}
                  onChange={(e) => handleAdvancedSettingChange('priorityFee', e.target.value)}
                />
              </div>
            </div>

            {/* Bribery Amount */}
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Bribery Amount</span>
                <Input
                  type="text"
                  className="w-24 bg-[#2c2d33] text-white text-sm px-2 py-1 h-8"
                  value={params.briberyAmount}
                  onChange={(e) => handleAdvancedSettingChange('briberyAmount', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <Button className="w-full bg-[#4c82fb] hover:bg-[#3b71ea] text-white py-3 rounded-lg text-sm font-medium">
        Quick {params.mode === 'buy' ? 'Buy' : 'Sell'}
      </Button>
    </div>
  );
};

export default TradingPanel;
