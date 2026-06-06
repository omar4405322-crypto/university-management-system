// redeployed: 2026-06-05
require('dotenv').config();

const REQUIRED_ENV_VARS = [ 
  'DATABASE_URL', 
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'REDIS_URL'
]; 

const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]); 
if (missing.length > 0) { 
  console.error('❌ FATAL: Missing required environment variables:'); 
  missing.forEach(key => console.error(`   - ${key}`)); 
  console.error('Please check your .env file.'); 
  process.exit(1); 
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
