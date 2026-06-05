// redeployed: 2026-06-05
require('dotenv').config();

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
const missingRequired = requiredEnv.filter(env => !process.env[env]);

if (missingRequired.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: Missing required environment variables:');
  missingRequired.forEach(env => console.error('\x1b[31m%s\x1b[0m', ` - ${env}`));
  process.exit(1);
}

const app = require('./app');
const http = require('http');
const { initSocket } = require('./utils/socket');
const logger = require('./utils/logger');

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`[SERVER] Running on http://localhost:${PORT}`);
  logger.info(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`[FATAL] Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});
