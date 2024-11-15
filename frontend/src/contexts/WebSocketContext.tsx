import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRealTimeStore } from '../store/realTimeStore';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false
});

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

let globalSocket: Socket | null = null;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastPing, setLastPing] = React.useState<number>(Date.now());
  const socketRef = useRef<Socket | null>(null);
  const { setSocket, subscribeToUpdates, unsubscribeFromUpdates } = useRealTimeStore();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        timeout: 20000,
        transports: ['websocket']
      });
    }

    socketRef.current = globalSocket;
    setSocket(globalSocket);

    const checkConnection = () => {
      const now = Date.now();
      if (now - lastPing > 45000) { // Se non riceviamo ping per 45 secondi
        console.warn('Nessun heartbeat ricevuto, riconnessione...');
        globalSocket?.disconnect();
        globalSocket?.connect();
      }
    };

    const handleConnect = () => {
      console.log('WebSocket connesso');
      setIsConnected(true);
      setLastPing(Date.now());
      subscribeToUpdates();

      // Avvia il controllo della connessione
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = setInterval(checkConnection, 15000);
    };

    const handleDisconnect = (reason: string) => {
      console.log('WebSocket disconnesso:', reason);
      setIsConnected(false);
      unsubscribeFromUpdates();

      // Pulisci gli intervalli
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      // Tenta la riconnessione dopo un delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!globalSocket?.connected) {
          console.log('Tentativo di riconnessione...');
          globalSocket?.connect();
        }
      }, 5000);
    };

    const handleError = (error: Error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    const handlePing = () => {
      setLastPing(Date.now());
      globalSocket?.emit('pong');
    };

    globalSocket.on('connect', handleConnect);
    globalSocket.on('disconnect', handleDisconnect);
    globalSocket.on('error', handleError);
    globalSocket.on('ping', handlePing);

    if (!globalSocket.connected) {
      globalSocket.connect();
    }

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      globalSocket?.off('connect', handleConnect);
      globalSocket?.off('disconnect', handleDisconnect);
      globalSocket?.off('error', handleError);
      globalSocket?.off('ping', handlePing);
      unsubscribeFromUpdates();
    };
  }, [setSocket, subscribeToUpdates, unsubscribeFromUpdates, lastPing]);

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export {};
