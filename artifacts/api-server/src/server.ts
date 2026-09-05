import dotenv from 'dotenv';
import os from 'os';
dotenv.config();

import crypto from 'crypto';
import pkg from '../package.json';
import logger from './utils/logger';
import { getJwtSecretValidationError } from './utils/jwtSecretValidation';
import { getTwoFactorConfigError } from './utils/twoFactorConfig';

logger.info(`🚀 [BOOT] Starting Smart University API v${pkg.version}`);

const isProduction = process.env.NODE_ENV === 'production';

// 1. Auto-fix JWT_SECRET in development if missing or weak
if (!isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  const tempSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = tempSecret;
  logger.warn('⚠️ [DEV] No strong JWT_SECRET found. Generated a temporary one for this session.');
}

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];

const OPTIONAL_ENV_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'REDIS_URL',
];

const missingRequired = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingRequired.length > 0) {
  logger.error('❌ FATAL: Missing required environment variables: ' + missingRequired.join(', '));
  logger.error('Please check your .env file.');
  process.exit(1);
}

const jwtSecretError = getJwtSecretValidationError(process.env.JWT_SECRET, isProduction ? 32 : 8);
if (jwtSecretError) {
  logger.error(`❌ FATAL: ${jwtSecretError}`);
  process.exit(1);
}


const twoFactorConfigError = getTwoFactorConfigError(
  process.env.NODE_ENV,
  process.env.REQUIRE_2FA
);
if (twoFactorConfigError) {
  logger.error(`❌ FATAL: ${twoFactorConfigError}`);
  process.exit(1);
}

const missingOptional = OPTIONAL_ENV_VARS.filter((key) => !process.env[key]);
if (missingOptional.length > 0) {
  logger.warn('⚠️ WARNING: Some optional environment variables are missing: ' + missingOptional.join(', '));
  logger.warn('Production features like Cloudinary storage and Redis caching will be disabled.');
}

import app from './app';
import http from 'http';
import { initSocket } from './utils/socket';
import { startRiskDetectionJob } from './utils/cron';

const server: http.Server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start scheduled jobs
startRiskDetectionJob();

const PORT: number = Number(process.env.PORT) || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[SERVER] Running on http://localhost:${PORT}`);
  
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        logger.info(`[SERVER] Running on http://${net.address}:${PORT} (Network)`);
      }
    }
  }
  
  logger.info(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.error(`[FATAL] Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});
