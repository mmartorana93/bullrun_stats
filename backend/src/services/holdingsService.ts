import { Connection, PublicKey } from '@solana/web3.js';
import { walletService } from './walletService';
import { EventEmitter } from 'events';
import axios from 'axios';

export interface TokenHolding {
    symbol: string;
    address: string;
    wallets: {
        address: string;
        amount: number;
    }[];
    invested: number;
    remaining: number;
    sold: number;
    pnl: number;
    pnlPercentage: number;
    source: 'trading' | 'sniping';
    lastPrice: number | null;
    lastUpdate: Date;
    error?: string;
}

export interface FormattedHolding extends Omit<TokenHolding, 'pnl' | 'pnlPercentage'> {
    pnl: number | 'N/A';
    pnlPercentage: number | 'N/A';
}

interface TokenBalance {
    mint: string;
    amount: number;
    decimals: number;
}

class HoldingsService extends EventEmitter {
    private connection: Connection;
    private holdings: Map<string, TokenHolding> = new Map();
    private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
    private readonly PRICE_CACHE_TTL = 60 * 1000; // 1 minuto

    constructor() {
        super();
        this.connection = new Connection(process.env.SOLANA_RPC_URL || '');
        this.initializeListeners();
    }

    private initializeListeners() {
        // Ascolta le nuove transazioni di trading
        this.on('newTransaction', async (transaction: any) => {
            await this.updateHoldingFromTransaction(transaction);
        });

        // Ascolta gli snipe completati
        this.on('snipeCompleted', async (snipe: any) => {
            await this.updateHoldingFromSnipe(snipe);
        });
    }

    private async getTokenPrice(tokenAddress: string): Promise<number | null> {
        try {
            const cached = this.priceCache.get(tokenAddress);
            if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
                return cached.price;
            }

            // Prova prima Jupiter
            const jupiterPrice = await this.getJupiterPrice(tokenAddress);
            if (jupiterPrice) {
                this.priceCache.set(tokenAddress, {
                    price: jupiterPrice,
                    timestamp: Date.now()
                });
                return jupiterPrice;
            }

            return null;
        } catch (error) {
            console.error('Errore nel recupero del prezzo:', error);
            return null;
        }
    }

    private async getJupiterPrice(tokenAddress: string): Promise<number | null> {
        try {
            const response = await axios.get(
                `https://price.jup.ag/v4/price?ids=${tokenAddress}`
            );
            return response.data.data[tokenAddress]?.price || null;
        } catch {
            return null;
        }
    }

    private createEmptyHolding(
        symbol: string,
        address: string,
        source: 'trading' | 'sniping'
    ): TokenHolding {
        return {
            symbol,
            address,
            wallets: [],
            invested: 0,
            remaining: 0,
            sold: 0,
            pnl: 0,
            pnlPercentage: 0,
            source,
            lastPrice: null,
            lastUpdate: new Date()
        };
    }

    private async updateHoldingFromTransaction(transaction: any) {
        const holding = this.holdings.get(transaction.token.address) || 
            this.createEmptyHolding(transaction.token.symbol, transaction.token.address, 'trading');

        // Aggiorna i valori in base al tipo di transazione
        if (transaction.type === 'buy') {
            holding.invested += transaction.amount_sol * (transaction.token.priceUsd || 0);
            holding.remaining += transaction.tokenAmount;
        } else if (transaction.type === 'sell') {
            holding.sold += transaction.amount_sol * (transaction.token.priceUsd || 0);
            holding.remaining -= transaction.tokenAmount;
        }

        // Aggiorna P&L
        const currentPrice = await this.getTokenPrice(transaction.token.address);
        if (currentPrice !== null) {
            holding.lastPrice = currentPrice;
            const currentValue = holding.remaining * currentPrice;
            holding.pnl = (currentValue + holding.sold) - holding.invested;
            holding.pnlPercentage = (holding.pnl / holding.invested) * 100;
            holding.error = undefined;
        } else {
            holding.error = 'Prezzo non disponibile';
        }

        // Aggiorna wallet
        this.updateWalletHolding(holding, transaction.wallet, transaction.tokenAmount);

        this.holdings.set(transaction.token.address, holding);
        this.emitHoldingsUpdate();
    }

    private async updateHoldingFromSnipe(snipe: any) {
        const holding = this.holdings.get(snipe.tokenAddress) || 
            this.createEmptyHolding(snipe.tokenName, snipe.tokenAddress, 'sniping');

        // Aggiorna i valori in base allo stato dello snipe
        if (snipe.status === 'IN') {
            holding.invested += snipe.buyAmount;
            holding.remaining += snipe.tokenAmount;
        } else if (snipe.status === 'TAKE_PROFIT' || snipe.status === 'STOP_LOSS') {
            holding.sold += snipe.sellAmount;
            holding.remaining -= snipe.tokenAmount;
        }

        // Aggiorna P&L
        const currentPrice = await this.getTokenPrice(snipe.tokenAddress);
        if (currentPrice !== null) {
            holding.lastPrice = currentPrice;
            const currentValue = holding.remaining * currentPrice;
            holding.pnl = (currentValue + holding.sold) - holding.invested;
            holding.pnlPercentage = (holding.pnl / holding.invested) * 100;
            holding.error = undefined;
        } else {
            holding.error = 'Prezzo non disponibile';
        }

        // Aggiorna wallet
        const wallet = walletService.getKeypair(snipe.walletId);
        if (wallet) {
            this.updateWalletHolding(holding, wallet.publicKey.toString(), snipe.tokenAmount);
        }

        this.holdings.set(snipe.tokenAddress, holding);
        this.emitHoldingsUpdate();
    }

    private updateWalletHolding(holding: TokenHolding, walletAddress: string, amount: number) {
        const walletIndex = holding.wallets.findIndex(w => w.address === walletAddress);
        if (walletIndex === -1) {
            holding.wallets.push({ address: walletAddress, amount });
        } else {
            holding.wallets[walletIndex].amount = amount;
        }
        // Rimuovi wallet con balance 0
        holding.wallets = holding.wallets.filter(w => w.amount > 0);
    }

    private formatHolding(holding: TokenHolding): FormattedHolding {
        return {
            ...holding,
            pnl: holding.lastPrice === null ? 'N/A' : holding.pnl,
            pnlPercentage: holding.lastPrice === null ? 'N/A' : holding.pnlPercentage
        };
    }

    private emitHoldingsUpdate() {
        const holdingsArray = Array.from(this.holdings.values())
            .filter(h => h.remaining > 0 || h.sold > 0)
            .map(this.formatHolding);
        
        // Emetti l'aggiornamento via WebSocket
        this.emit('holdingsUpdate', holdingsArray);
    }

    // API pubblica
    async getHoldings(): Promise<FormattedHolding[]> {
        return Array.from(this.holdings.values())
            .filter(h => h.remaining > 0 || h.sold > 0)
            .map(this.formatHolding);
    }

    async refreshPrices(): Promise<void> {
        for (const [address, holding] of this.holdings) {
            const price = await this.getTokenPrice(address);
            if (price !== null) {
                holding.lastPrice = price;
                const currentValue = holding.remaining * price;
                holding.pnl = (currentValue + holding.sold) - holding.invested;
                holding.pnlPercentage = (holding.pnl / holding.invested) * 100;
                holding.error = undefined;
            } else {
                holding.error = 'Prezzo non disponibile';
            }
            holding.lastUpdate = new Date();
        }
        this.emitHoldingsUpdate();
    }
}

export const holdingsService = new HoldingsService();
