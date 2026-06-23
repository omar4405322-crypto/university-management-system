import winston from 'winston';

const logger: winston.Logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'university-management-system' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
              winston.format.printf(({ level, message, timestamp, stack }: any) => {
                if (stack) return `${timestamp} ${level}: ${message} - ${stack}`;
                return `${timestamp} ${level}: ${message}`;
              })
            ),
    }),
  ],
});

export default logger;
