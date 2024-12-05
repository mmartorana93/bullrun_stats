import { useState, useEffect } from 'react';
import { holdingsService, WalletTokensResponse } from '../services/holdingsService';

export const useHoldingsService = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [holdings, setHoldings] = useState<WalletTokensResponse | null>(null);

    const fetchHoldings = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Recupera i token del wallet principale
            const tokens = await holdingsService.getMyTokens();
            setHoldings(tokens);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nel recupero dei token');
            console.error('Errore nel recupero dei token:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshPrices = async () => {
        try {
            const updatedTokens = await holdingsService.refreshPrices();
            setHoldings(updatedTokens);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nell\'aggiornamento dei prezzi');
            console.error('Errore nell\'aggiornamento dei prezzi:', err);
        }
    };

    useEffect(() => {
        fetchHoldings();
        
        // Aggiorna i prezzi ogni minuto
        const interval = setInterval(refreshPrices, 60000);
        
        return () => clearInterval(interval);
    }, []);

    return {
        holdings,
        loading,
        error,
        refreshPrices,
        refetch: fetchHoldings
    };
};
