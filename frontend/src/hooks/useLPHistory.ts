import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

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

interface HourlyStats {
    timestamp: string;
    totalPools: number;
    safePools: number;
    riskyPools: number;
    avgUsdValue: number;
}

interface RiskDistribution {
    id: string;
    label: string;
    value: number;
    color: string;
}

const POOLS_STORAGE_KEY = 'lptracking_pools_history';
const STATS_STORAGE_KEY = 'lptracking_hourly_stats';

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

    const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>(() => {
        try {
            const saved = localStorage.getItem(STATS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Errore nel caricamento delle statistiche orarie:', error);
            return [];
        }
    });

    // Salva lo storico dei pool
    useEffect(() => {
        try {
            localStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(poolsHistory));
        } catch (error) {
            console.error('Errore nel salvataggio dello storico pool:', error);
        }
    }, [poolsHistory]);

    // Salva le statistiche orarie
    useEffect(() => {
        try {
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(hourlyStats));
        } catch (error) {
            console.error('Errore nel salvataggio delle statistiche orarie:', error);
        }
    }, [hourlyStats]);

    // Aggiunge un nuovo pool allo storico
    const addPool = useCallback((pool: Pool) => {
        setPoolsHistory(prev => {
            const newHistory = [pool, ...prev].slice(0, 1000); // Mantiene gli ultimi 1000 pool
            return newHistory;
        });
    }, []);

    // Calcola le statistiche orarie
    const updateHourlyStats = useCallback(() => {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const hourlyPools = poolsHistory.filter(
            pool => new Date(pool.timestamp) >= hourAgo
        );

        const stats: HourlyStats = {
            timestamp: format(now, "yyyy-MM-dd'T'HH:mm:ss"),
            totalPools: hourlyPools.length,
            safePools: hourlyPools.filter(p => p.riskAnalysis.isSafeToBuy).length,
            riskyPools: hourlyPools.filter(p => !p.riskAnalysis.isSafeToBuy).length,
            avgUsdValue: hourlyPools.reduce((acc, p) => acc + p.usdValue, 0) / (hourlyPools.length || 1)
        };

        setHourlyStats(prev => {
            const newStats = [stats, ...prev].slice(0, 24); // Mantiene le ultime 24 ore
            return newStats;
        });
    }, [poolsHistory]);

    // Calcola la distribuzione dei rischi
    const calculateRiskDistribution = useCallback((): RiskDistribution[] => {
        const lastHourPools = poolsHistory.filter(
            pool => new Date(pool.timestamp) >= new Date(Date.now() - 60 * 60 * 1000)
        );

        const distribution = {
            safe: 0,
            mutableMetadata: 0,
            freezeAuthority: 0,
            mintAuthority: 0
        };

        lastHourPools.forEach(pool => {
            const { flags } = pool.riskAnalysis;
            if (pool.riskAnalysis.isSafeToBuy) {
                distribution.safe++;
            }
            if (flags.mutable_metadata) distribution.mutableMetadata++;
            if (flags.freeze_authority_enabled) distribution.freezeAuthority++;
            if (flags.mint_authority_enabled) distribution.mintAuthority++;
        });

        return [
            {
                id: 'safe',
                label: 'Pool Sicure',
                value: distribution.safe,
                color: '#4caf50'
            },
            {
                id: 'mutableMetadata',
                label: 'Metadata Mutabile',
                value: distribution.mutableMetadata,
                color: '#ff9800'
            },
            {
                id: 'freezeAuthority',
                label: 'Freeze Authority',
                value: distribution.freezeAuthority,
                color: '#f44336'
            },
            {
                id: 'mintAuthority',
                label: 'Mint Authority',
                value: distribution.mintAuthority,
                color: '#9c27b0'
            }
        ];
    }, [poolsHistory]);

    // Aggiorna le statistiche ogni ora
    useEffect(() => {
        updateHourlyStats();
        const interval = setInterval(updateHourlyStats, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [updateHourlyStats]);

    return {
        poolsHistory,
        hourlyStats,
        addPool,
        calculateRiskDistribution
    };
};
