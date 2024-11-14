import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import { rugcheckService } from '../services/rugcheckService';
import { dextoolsService } from '../services/dextoolsService';
import { Transaction } from '../types';

interface PoolMetrics {
    pricePerTokenSOL: number;
    pricePerTokenUSD: number;
    poolDepth: number;
    normalizedLiquidity: number;
    timestamp: number;
}

interface PoolChanges {
    priceChangeSOL: number;
    priceChangeUSD: number;
    liquidityChange: number;
    timeframe: number;
}

interface Pool {
    tokenAccount: string;
    tokenAmount: number;
    solanaAmount: number;
    usdValue: number;
    timestamp: string;
    txId: string;
    metrics: PoolMetrics;
    changes?: PoolChanges;
    riskAnalysis?: {
        flags: {
            mutable_metadata: boolean;
            freeze_authority_enabled: boolean;
            mint_authority_enabled: boolean;
        };
        isSafeToBuy: boolean;
    };
}

interface RealTimeState {
    pools: Pool[];
    transactions: Transaction[];
    isLoading: boolean;
    socket: Socket | null;
    setSocket: (socket: Socket) => void;
    addPool: (pool: Pool) => Promise<void>;
    setPools: (pools: Pool[]) => void;
    addTransaction: (transaction: Transaction) => void;
    setTransactions: (transactions: Transaction[]) => void;
    setIsLoading: (loading: boolean) => void;
    subscribeToUpdates: () => void;
    unsubscribeFromUpdates: () => void;
}

const analyzeToken = async (tokenAddress: string) => {
    try {
        const [riskAnalysis, tokenPrice] = await Promise.all([
            rugcheckService.analyzeToken(tokenAddress),
            dextoolsService.getTokenPrice(tokenAddress)
        ]);

        return riskAnalysis;
    } catch (error) {
        console.error('Errore nell\'analisi del token:', error);
        return {
            flags: {
                mutable_metadata: false,
                freeze_authority_enabled: false,
                mint_authority_enabled: false
            },
            isSafeToBuy: false
        };
    }
};

export const useRealTimeStore = create<RealTimeState>((set, get) => ({
    pools: [],
    transactions: [],
    isLoading: false,
    socket: null,

    setSocket: (socket: Socket) => set({ socket }),

    addPool: async (pool: Pool) => {
        console.log('Aggiunta nuovo pool:', pool);
        set({ isLoading: true });
        try {
            const riskAnalysis = await analyzeToken(pool.tokenAccount);
            const enrichedPool = { ...pool, riskAnalysis };
            
            set(state => {
                // Verifica se il pool esiste già
                const existingPoolIndex = state.pools.findIndex(p => p.txId === pool.txId);
                
                if (existingPoolIndex !== -1) {
                    // Aggiorna il pool esistente
                    const updatedPools = [...state.pools];
                    updatedPools[existingPoolIndex] = enrichedPool;
                    return {
                        pools: updatedPools,
                        isLoading: false
                    };
                } else {
                    // Aggiungi il nuovo pool
                    return {
                        pools: [enrichedPool, ...state.pools].slice(0, 100),
                        isLoading: false
                    };
                }
            });
        } catch (error) {
            console.error('Errore nell\'aggiunta del pool:', error);
            set({ isLoading: false });
        }
    },

    setPools: async (pools: Pool[]) => {
        console.log('Setting pools:', pools);
        set({ isLoading: true });
        try {
            const enrichedPools = await Promise.all(
                pools.map(async pool => {
                    if (!pool.riskAnalysis) {
                        const riskAnalysis = await analyzeToken(pool.tokenAccount);
                        return { ...pool, riskAnalysis };
                    }
                    return pool;
                })
            );
            
            set({ 
                pools: enrichedPools,
                isLoading: false 
            });
        } catch (error) {
            console.error('Errore nel setting dei pools:', error);
            set({ isLoading: false });
        }
    },

    addTransaction: (transaction: Transaction) => {
        console.log('Aggiunta nuova transazione:', transaction);
        set(state => ({
            transactions: [transaction, ...state.transactions].slice(0, 100)
        }));
    },

    setTransactions: (transactions: Transaction[]) => {
        console.log('Setting transactions:', transactions);
        set({ transactions });
    },

    setIsLoading: (loading: boolean) => set({ isLoading: loading }),

    subscribeToUpdates: () => {
        const { socket } = get();
        if (!socket) {
            console.warn('Socket non disponibile per la sottoscrizione');
            return;
        }

        console.log('Sottoscrizione agli aggiornamenti...');

        // Richiedi i pool esistenti
        socket.emit('getPools');

        // Richiedi le transazioni esistenti
        socket.emit('getTransactions');

        // Gestisci i pool esistenti
        socket.on('existingPools', async (pools: Pool[]) => {
            console.log('Ricevuti pool esistenti:', pools);
            const { setPools } = get();
            await setPools(pools);
        });

        // Gestisci le transazioni esistenti
        socket.on('existingTransactions', (transactions: Transaction[]) => {
            console.log('Ricevute transazioni esistenti:', transactions);
            const { setTransactions } = get();
            setTransactions(transactions);
        });

        // Gestisci i nuovi pool
        socket.on('newPool', async (pool: Pool) => {
            console.log('Ricevuto nuovo pool:', pool);
            const { addPool } = get();
            await addPool(pool);
        });

        // Gestisci le nuove transazioni
        socket.on('newTransaction', (transaction: Transaction) => {
            console.log('Ricevuta nuova transazione:', transaction);
            const { addTransaction } = get();
            addTransaction(transaction);
        });
    },

    unsubscribeFromUpdates: () => {
        const { socket } = get();
        if (!socket) {
            console.warn('Socket non disponibile per la disottoscrizione');
            return;
        }

        console.log('Disottoscrizione dagli aggiornamenti...');
        socket.off('existingPools');
        socket.off('existingTransactions');
        socket.off('newPool');
        socket.off('newTransaction');
    }
}));
