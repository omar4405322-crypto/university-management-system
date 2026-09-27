import { Server, Socket } from "socket.io";
import http from "node:http";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "./jwt.utils";
import logger from "./logger";
import prisma from "./prismaClient";

export interface AuthenticatedSocket extends Socket {
  user?: any;
}

export interface SocketInitOptions {
  pubClient?: any;
  subClient?: any;
  adapter?: any;
  corsOrigins?: string[];
}

let io: Server | undefined;
let pubClient: Redis | undefined;
let subClient: Redis | undefined;
let adapterMode: "redis" | "standalone" = "standalone";

export const getUserRoom = (userId: string | number): string => `user_${userId}`;
export const getRoleRoom = (role: string): string => `role_${role}`;

export const requireActiveSocketAccount = async (decoded: {
  id: number;
  tokenVersion?: number;
}): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { tokenVersion: true, isActive: true },
  });

  if (!user) {
    throw new Error("Authentication error: User not found");
  }
  if (user.isActive === false) {
    throw new Error("Authentication error: Account deactivated");
  }
  if (user.tokenVersion !== decoded.tokenVersion) {
    throw new Error("Authentication error: Token invalidated");
  }
};

export const getSocketAdapterStatus = () => {
  return {
    mode: adapterMode,
    configured: adapterMode === "redis",
    pubStatus: pubClient ? (pubClient as any).status : "none",
    subStatus: subClient ? (subClient as any).status : "none",
  };
};

/**
 * Initialize Socket.io server with Redis cross-instance adapter when available.
 */
export const initSocket = (
  server: http.Server,
  options: SocketInitOptions = {}
): Server => {
  const corsOrigins =
    options.corsOrigins ??
    (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:5173"]);

  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Setup adapter for cross-instance horizontal scaling
  if (options.adapter) {
    io.adapter(options.adapter);
    adapterMode = "redis";
    logger.info("[SOCKET] Attached custom distributed adapter.");
  } else if (options.pubClient && options.subClient) {
    pubClient = options.pubClient;
    subClient = options.subClient;
    io.adapter(createAdapter(pubClient, subClient));
    adapterMode = "redis";
    logger.info("[SOCKET] Attached custom Redis pub/sub clients to adapter.");
  } else if (process.env.REDIS_URL) {
    try {
      pubClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          return Math.min(times * 50, 2000);
        },
      });

      subClient = pubClient.duplicate();

      pubClient.on("error", (err: Error) =>
        logger.error(`[SOCKET] Redis Pub client error: ${err.message}`)
      );
      subClient.on("error", (err: Error) =>
        logger.error(`[SOCKET] Redis Sub client error: ${err.message}`)
      );

      io.adapter(createAdapter(pubClient, subClient));
      adapterMode = "redis";
      logger.info("[SOCKET] Initialized Redis Pub/Sub adapter for cross-instance event distribution.");
    } catch (err: any) {
      adapterMode = "standalone";
      logger.error(`[SOCKET] Failed to initialize Redis adapter: ${err.message}`, {
        stack: err.stack,
      });
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Critical: Failed to initialize Socket.IO Redis adapter in production: ${err.message}`);
      }
    }
  } else {
    adapterMode = "standalone";
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        "[SOCKET] WARNING: REDIS_URL not configured in production. Socket.IO will run in standalone mode without cross-instance event distribution."
      );
    } else {
      logger.info(
        "[SOCKET] Running Socket.IO in standalone in-memory mode (development/test)."
      );
    }
  }

  // Authentication Middleware for Sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = verifyToken(token) as any;
      await requireActiveSocketAccount(decoded);

      socket.user = decoded;
      next();
    } catch {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    if (!socket.user) return; // safety check

    logger.info(`[SOCKET] User connected: ${socket.user.id}`);

    // Join a private room for targeted notifications
    socket.join(getUserRoom(socket.user.id));

    // Join role-based rooms
    if (socket.user.role) {
      socket.join(getRoleRoom(socket.user.role));
    }

    socket.on("disconnect", () => {
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
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

/**
 * Send notification to a specific user
 */
export const sendToUser = (
  userId: string | number,
  event: string,
  data: any
): void => {
  if (io) {
    io.to(getUserRoom(userId)).emit(event, data);
  }
};

/**
 * Broadcast to a specific role
 */
export const broadcastToRole = (
  role: string,
  event: string,
  data: any
): void => {
  if (io) {
    io.to(getRoleRoom(role)).emit(event, data);
  }
};

/**
 * Close Socket.IO server, disconnect clients, and close adapter Redis pub/sub clients cleanly.
 */
export const closeSocket = async (): Promise<void> => {
  if (io) {
    try {
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => {
        io!.close(() => resolve());
      });
      logger.info("[SOCKET] Closed Socket.IO server and disconnected all clients");
    } catch (err: any) {
      logger.warn(`[SOCKET] Error closing Socket.IO server: ${err.message}`);
    }
    io = undefined;
  }

  const closePubSubClient = async (client: Redis | undefined, name: string) => {
    if (!client) return;
    try {
      if (client.status === "ready" || client.status === "connecting") {
        await client.quit();
      } else {
        client.disconnect();
      }
      logger.info(`[SOCKET] Disconnected Redis ${name} client cleanly`);
    } catch (err: any) {
      logger.warn(`[SOCKET] Error quitting Redis ${name} client: ${err.message}`);
      try {
        client.disconnect();
      } catch {
        // Ignore disconnect error
      }
    }
  };

  await Promise.all([
    closePubSubClient(pubClient, "Pub"),
    closePubSubClient(subClient, "Sub"),
  ]);

  pubClient = undefined;
  subClient = undefined;
  adapterMode = "standalone";
};

export const resetSocketForTest = (): void => {
  io = undefined;
  pubClient = undefined;
  subClient = undefined;
  adapterMode = "standalone";
};
