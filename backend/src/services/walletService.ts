import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

export interface Wallet {
    id: string;
    name: string;
    publicKey: string;
}

export interface WalletOperation {
    success: boolean;
    message?: string;
    data?: any;
}

export interface MonitoredWallet {
    address: string;
    status: 'active' | 'paused';
    lastUpdate: Date;
}

class WalletService {
    private connection: Connection;
    private wallets: Map<string, Keypair>;
    private monitoredWallets: Map<string, MonitoredWallet>;

    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL || '');
        this.wallets = new Map();
        this.monitoredWallets = new Map();
        this.initializeWallets();
    }

    private initializeWallets() {
        // Carica i wallet dal file .env
        const walletKeys = Object.keys(process.env)
            .filter(key => key.startsWith('WALLET_PRIVATE_KEY_'));

        walletKeys.forEach(key => {
            const privateKey = process.env[key];
            if (privateKey) {
                try {
                    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
                    const id = key.replace('WALLET_PRIVATE_KEY_', '');
                    this.wallets.set(id, keypair);
                    
                    // Inizializza il monitoraggio per questo wallet
                    this.monitoredWallets.set(keypair.publicKey.toString(), {
                        address: keypair.publicKey.toString(),
                        status: 'active',
                        lastUpdate: new Date()
                    });
                } catch (error) {
                    console.error(`Errore nel caricamento del wallet ${key}:`, error);
                }
            }
        });
    }

    async getWallets(): Promise<Wallet[]> {
        const walletList: Wallet[] = [];
        
        for (const [id, keypair] of this.wallets) {
            const name = process.env[`WALLET_NAME_${id}`] || `Wallet ${id}`;
            walletList.push({
                id,
                name,
                publicKey: keypair.publicKey.toString()
            });
        }

        return walletList;
    }

    async getWalletBalance(walletId: string): Promise<WalletOperation> {
        try {
            const keypair = this.wallets.get(walletId);
            if (!keypair) {
                return { success: false, message: 'Wallet non trovato' };
            }

            const balance = await this.connection.getBalance(keypair.publicKey);
            return {
                success: true,
                data: {
                    sol: balance / 1e9,
                    lamports: balance
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore sconosciuto'
            };
        }
    }

    getKeypair(walletId: string): Keypair | null {
        return this.wallets.get(walletId) || null;
    }

    async validateAddress(address: string): Promise<boolean> {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    // Metodi per il monitoraggio dei wallet
    async getMonitoredWallets(): Promise<MonitoredWallet[]> {
        return Array.from(this.monitoredWallets.values());
    }

    async pauseWallet(address: string): Promise<boolean> {
        const wallet = this.monitoredWallets.get(address);
        if (wallet) {
            wallet.status = 'paused';
            wallet.lastUpdate = new Date();
            this.monitoredWallets.set(address, wallet);
            return true;
        }
        return false;
    }

    async resumeWallet(address: string): Promise<boolean> {
        const wallet = this.monitoredWallets.get(address);
        if (wallet) {
            wallet.status = 'active';
            wallet.lastUpdate = new Date();
            this.monitoredWallets.set(address, wallet);
            return true;
        }
        return false;
    }

    isWalletMonitored(address: string): boolean {
        return this.monitoredWallets.has(address);
    }

    getWalletStatus(address: string): 'active' | 'paused' | null {
        return this.monitoredWallets.get(address)?.status || null;
    }

    // Metodo per ottenere il saldo SOL in USD
    async getWalletBalanceUSD(walletId: string): Promise<WalletOperation> {
        try {
            const balanceResult = await this.getWalletBalance(walletId);
            if (!balanceResult.success) {
                return balanceResult;
            }

            // Qui potresti aggiungere la logica per ottenere il prezzo SOL/USD
            // Per ora usiamo un placeholder
            const solPrice = 100; // Questo dovrebbe essere ottenuto da un price feed
            const usdBalance = balanceResult.data.sol * solPrice;

            return {
                success: true,
                data: {
                    ...balanceResult.data,
                    usd: usdBalance
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore sconosciuto'
            };
        }
    }
}

export const walletService = new WalletService();
