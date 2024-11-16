import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const { updateWalletsStatus } = useRealTimeStore();

  useEffect(() => {
    const connectSocket = () => {
      const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socket.on('connect', () => {
        console.log('WebSocket connesso');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      });

      socket.on('walletsStatus', (data) => {
        console.log('Received walletsStatus:', data);
        if (data.wallets && data.status) {
          updateWalletsStatus(data.wallets, data.status === 'connected');
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnesso:', reason);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Errore connessione WebSocket:', error);
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          socket.disconnect();
        }
      });

      socket.on('newTransaction', (data) => {
        console.log('Received new transaction:', data);
      });

      socket.on('walletUpdate', (data) => {
        console.log('Received wallet update:', data);
      });

      // Ping ogni 30s per mantenere la connessione
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000);

      socketRef.current = socket;

      return () => {
        clearInterval(pingInterval);
        socket.disconnect();
      };
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
