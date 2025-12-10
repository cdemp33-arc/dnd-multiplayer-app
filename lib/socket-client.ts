import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = async (): Promise<Socket> => {
  if (!socket) {
    await fetch('/api/socket');
    socket = io({
      path: '/api/socket',
      addTrailingSlash: false,
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};
