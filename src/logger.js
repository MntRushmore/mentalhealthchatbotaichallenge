// Logger Module - Audit logging and monitoring
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: fileFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for crisis events
    new winston.transports.File({
      filename: 'logs/crisis.log',
      level: 'alert',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
  // Custom levels for mental health monitoring
  levels: {
    error: 0,
    warn: 1,
    alert: 2, // For crisis situations
    info: 3,
    http: 4,
    debug: 5,
  },
});

// Add custom alert method
winston.addColors({
  error: 'red',
  warn: 'yellow',
  alert: 'magenta bold',
  info: 'green',
  http: 'cyan',
  debug: 'blue',
});

// Wrapper methods for cleaner usage
export default {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  alert: (message, meta = {}) => logger.log('alert', message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  http: (message, meta = {}) => logger.http(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),

  // Specialized logging methods
  logConversation: (phoneNumber, message, isIncoming, riskLevel = 'none') => {
    logger.info('Conversation', {
      type: 'message',
      phoneNumber: phoneNumber.slice(-4), // Only log last 4 digits for privacy
      direction: isIncoming ? 'incoming' : 'outgoing',
      messageLength: message.length,
      riskLevel,
      timestamp: new Date().toISOString(),
    });
  },

  logCrisis: (phoneNumber, assessment) => {
    logger.log('alert', 'Crisis detected', {
      type: 'crisis',
      phoneNumber: phoneNumber.slice(-4), // Only log last 4 digits for privacy
      level: assessment.level,
      categories: assessment.categories,
      requiresIntervention: assessment.requiresImmediateIntervention,
      timestamp: new Date().toISOString(),
    });
  },

  logAPICall: (service, endpoint, duration, status) => {
    logger.http('API Call', {
      type: 'api',
      service,
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  },

  logError: (error, context = {}) => {
    logger.error('Error occurred', {
      type: 'error',
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  },
};
