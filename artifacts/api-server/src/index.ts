// @ts-ignore
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  const tempSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = tempSecret;
  console.warn('⚠️ [DEV] No strong JWT_SECRET found. Generated a temporary one for this session.');
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
import { startRiskDetectionJob } from './utils/cron';
// @ts-ignore
import logger from './utils/logger';

const rawPort = process.env['PORT'];
if (!rawPort) {
  console.error('PORT environment variable is required');
  process.exit(1);
}

const PORT = Number(rawPort);
const server: http.Server = http.createServer(app);

initSocket(server);
startRiskDetectionJob();

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[SERVER] Running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err: any) => {
  logger.error(`[FATAL] Unhandled Rejection: ${err?.message}`, { stack: err?.stack });
  server.close(() => process.exit(1));
});
