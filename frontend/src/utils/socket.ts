import { io, Socket } from 'socket.io-client';

const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || '/api';
// Extract origin from backendUrl if it's an absolute URL
let socketUrl = '/';
try {
  if (backendUrl.startsWith('http')) {
    const url = new URL(backendUrl);
    socketUrl = url.origin;
  }
} catch (err) {
  // Ignore
}

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(socketUrl, {
      auth: {
        token
      }
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
