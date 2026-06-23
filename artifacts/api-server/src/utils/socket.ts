import { Server, Socket } from 'socket.io';
import http from 'http';
import { verifyToken } from './jwt.utils';
import logger from './logger';
import prisma from './prismaClient';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

let io: Server | undefined;

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 */
export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Authentication Middleware for Sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = verifyToken(token) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      if (user.tokenVersion !== decoded.tokenVersion) {
        return next(new Error('Authentication error: Token invalidated — please log in again'));
      }

      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) return; // safety check

    logger.info(`[SOCKET] User connected: ${socket.user.id}`);

    // Join a private room for targeted notifications
    socket.join(`user_${socket.user.id}`);

    // Join role-based rooms
    if (socket.user.role) {
      socket.join(`role_${socket.user.role}`);
    }

    socket.on('disconnect', () => {
      logger.info(`[SOCKET] User disconnected: ${socket.user.id}`);
    });
  });

  return io;
};

/**
 * Get Socket.io instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

/**
 * Send notification to a specific user
 */
export const sendToUser = (userId: string | number, event: string, data: any): void => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

/**
 * Broadcast to a specific role
 */
export const broadcastToRole = (role: string, event: string, data: any): void => {
  if (io) {
    io.to(`role_${role}`).emit(event, data);
  }
};
