import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        transports: ['websocket']
      });
    }

    socketRef.current = globalSocket;

    const handleConnect = () => {
      console.log('WebSocket connesso');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('WebSocket disconnesso');
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    globalSocket.on('connect', handleConnect);
    globalSocket.on('disconnect', handleDisconnect);
    globalSocket.on('error', handleError);

    if (!globalSocket.connected) {
      globalSocket.connect();
    }

    return () => {
      globalSocket?.off('connect', handleConnect);
      globalSocket?.off('disconnect', handleDisconnect);
      globalSocket?.off('error', handleError);
    };
  }, []);

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

// Aggiunto export vuoto per risolvere l'errore di TypeScript
export {};
