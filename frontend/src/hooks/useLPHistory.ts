import { useState, useEffect, useCallback } from 'react';

interface Pool {
    tokenAccount: string;
    tokenAmount: number;
    solanaAmount: number;
    usdValue: number;
    timestamp: string;
    txId: string;
    riskAnalysis: {
        flags: {
            mutable_metadata: boolean;
            freeze_authority_enabled: boolean;
            mint_authority_enabled: boolean;
        };
        isSafeToBuy: boolean;
    };
}

const POOLS_STORAGE_KEY = 'lptracking_pools_history';

export const useLPHistory = () => {
    const [poolsHistory, setPoolsHistory] = useState<Pool[]>(() => {
        try {
            const saved = localStorage.getItem(POOLS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Errore nel caricamento dello storico pool:', error);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(poolsHistory));
        } catch (error) {
            console.error('Errore nel salvataggio dello storico pool:', error);
        }
    }, [poolsHistory]);

    const addPool = useCallback((pool: Pool) => {
        setPoolsHistory(prev => {
            const newHistory = [pool, ...prev].slice(0, 1000);
            return newHistory;
        });
    }, []);

    return {
        pools: poolsHistory,
        addPool
    };
};
