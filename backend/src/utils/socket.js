const { Server } = require('socket.io');
const { verifyToken } = require('./jwt.utils');
const logger = require('./logger');

let io;

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authentication Middleware for Sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
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
const getIO = () => {
  // Gracefully handle missing Socket.io for Serverless environments (Vercel)
  if (!io) {
    logger.warn('[SOCKET] Socket.io not initialized (expected in Serverless/Vercel)');
    return {
      to: () => ({ emit: () => {} }),
      emit: () => {},
    };
  }
  return io;
};

/**
 * Send notification to a specific user
 */
const sendToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  } else {
    logger.debug(`[SOCKET] Mock sendToUser: ${userId} -> ${event}`);
  }
};

/**
 * Broadcast to a specific role
 */
const broadcastToRole = (role, event, data) => {
  if (io) {
    io.to(`role_${role}`).emit(event, data);
  } else {
    logger.debug(`[SOCKET] Mock broadcastToRole: ${role} -> ${event}`);
  }
};

module.exports = {
  initSocket,
  getIO,
  sendToUser,
  broadcastToRole,
};
