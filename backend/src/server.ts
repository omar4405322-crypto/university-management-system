import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import pkg from '../package.json';

console.log(`🚀 [BOOT] Starting Smart University API v${pkg.version}`);

const isProduction = process.env.NODE_ENV === 'production';

// 1. Auto-fix JWT_SECRET in development if missing or weak
if (!isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  const tempSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = tempSecret;
  console.warn('⚠️ [DEV] No strong JWT_SECRET found. Generated a temporary one for this session.');
}

const REQUIRED_ENV_VARS = [ 
  'DATABASE_URL', 
  'JWT_SECRET',
]; 

const OPTIONAL_ENV_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'REDIS_URL'
];

const missingRequired = REQUIRED_ENV_VARS.filter(key => !process.env[key]); 
if (missingRequired.length > 0) { 
  console.error('❌ FATAL: Missing required environment variables:'); 
  missingRequired.forEach(key => console.error(`   - ${key}`)); 
  console.error('Please check your .env file.'); 
  process.exit(1); 
} 

// Security Check: JWT_SECRET strength
const jwtSecret = process.env.JWT_SECRET || '';
const weakSecrets = ['your-super-secret-key-change-this', 'secret', 'changeme', 'replace-with-any-32-char-string-for-tests']; 

if (weakSecrets.includes(jwtSecret)) {
  console.error('❌ FATAL: JWT_SECRET is using a default/insecure value.');
  console.error('👉 Fix: Set a unique JWT_SECRET in your platform (Vercel/Railway) environment settings.');
  process.exit(1);
}

if (isProduction && jwtSecret.length < 32) {
  console.error(`❌ FATAL: JWT_SECRET must be at least 32 characters in production (currently ${jwtSecret.length}).`);
  console.error('👉 Fix: Generate a strong secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
} else if (jwtSecret.length < 8) {
  console.error('❌ FATAL: JWT_SECRET is dangerously short.');
  process.exit(1);
}

const missingOptional = OPTIONAL_ENV_VARS.filter(key => !process.env[key]);
if (missingOptional.length > 0) {
  console.warn('⚠️ WARNING: Some optional environment variables are missing:');
  missingOptional.forEach(key => console.warn(`   - ${key}`));
  console.warn('Production features like Cloudinary storage and Redis caching will be disabled.');
}

import app from './app.js';
import http from 'http';
import { initSocket } from './utils/socket.js';
import { startRiskDetectionJob } from './utils/cron.js';
import logger from './utils/logger.js';

const server: http.Server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start scheduled jobs
startRiskDetectionJob();

const PORT: number = Number(process.env.PORT) || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[SERVER] Running on http://localhost:${PORT}`);
  logger.info(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.error(`[FATAL] Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});
