import { useEffect } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { holdingsService, TokenHolding } from '../services/holdingsService';

export const useHoldingsService = () => {
    const { socket } = useWebSocket();

    useEffect(() => {
        holdingsService.setSocket(socket);
    }, [socket]);

    return holdingsService;
};
