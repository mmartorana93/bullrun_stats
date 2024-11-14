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
  const socketRef = useRef<Socket | null>(null);
  const { setSocket, subscribeToUpdates, unsubscribeFromUpdates } = useRealTimeStore();

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
    setSocket(globalSocket);

    const handleConnect = () => {
      console.log('WebSocket connesso');
      setIsConnected(true);
      subscribeToUpdates();
    };

    const handleDisconnect = () => {
      console.log('WebSocket disconnesso');
      setIsConnected(false);
      unsubscribeFromUpdates();
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
      unsubscribeFromUpdates();
    };
  }, [setSocket, subscribeToUpdates, unsubscribeFromUpdates]);

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
