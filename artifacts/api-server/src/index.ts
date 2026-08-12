// @ts-ignore
import dotenv from 'dotenv';
import os from 'os';
dotenv.config();

import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET environment variable is not set or too short (min 32 chars). Exiting.');
  process.exit(1);
}

const REQUIRED_ENV_VARS = ['DATABASE_URL'];
const missingRequired = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingRequired.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:', missingRequired.join(', '));
  process.exit(1);
}

// @ts-ignore
import app from './app';
import http from 'http';
// @ts-ignore
import { initSocket } from './utils/socket';
// @ts-ignore
import { startRiskDetectionJob, startSessionAutoExpiryJob } from './utils/cron';
// @ts-ignore
import logger from './utils/logger';

// @ts-ignore
import killPort from 'kill-port';

const rawPort = process.env['PORT'];
if (!rawPort) {
  console.error('PORT environment variable is required');
  process.exit(1);
}

const PORT = Number(rawPort);
const server: http.Server = http.createServer(app);

initSocket(server);
startRiskDetectionJob();
startSessionAutoExpiryJob();

const startServer = () => {
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[SERVER] Running on http://localhost:${PORT}`);
    
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          logger.info(`[SERVER] Running on http://${net.address}:${PORT} (Network)`);
        }
      }
    }
  });
};

if (process.env.NODE_ENV === 'production') {
  startServer();
} else {
  // Attempt to kill whatever is on the port first, then start the server.
  killPort(PORT, 'tcp')
    .then(() => {
      logger.info(`[SERVER] Cleared port ${PORT}`);
      startServer();
    })
    .catch(() => {
      // Port might not be in use, or we lack permissions. Just try starting anyway.
      startServer();
    });
}

process.on('unhandledRejection', (err: any) => {
  console.error('[FATAL] Unhandled Rejection:', err);
  logger.error(`[FATAL] Unhandled Rejection: ${err?.message}`, { stack: err?.stack });
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err: any) => {
  console.error('[FATAL] Uncaught Exception:', err);
  logger.error(`[FATAL] Uncaught Exception: ${err?.message}`, { stack: err?.stack });
  server.close(() => process.exit(1));
});
