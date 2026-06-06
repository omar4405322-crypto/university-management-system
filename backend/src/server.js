// redeployed: 2026-06-05
require('dotenv').config();

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
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;
const weakSecrets = ['your-super-secret-key-change-this', 'secret', 'changeme', 'replace-with-any-32-char-string-for-tests']; 

if (weakSecrets.includes(jwtSecret)) {
  console.error('❌ FATAL: JWT_SECRET is using a default/insecure value.');
  console.error('👉 Fix: Set a unique JWT_SECRET in your Vercel/Environment settings.');
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

const app = require('./app');
const http = require('http');
const { initSocket } = require('./utils/socket');
const { startRiskDetectionJob } = require('./utils/cron');
const logger = require('./utils/logger');

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start scheduled jobs
startRiskDetectionJob();

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[SERVER] Running on http://localhost:${PORT}`);
  logger.info(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`[FATAL] Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});
