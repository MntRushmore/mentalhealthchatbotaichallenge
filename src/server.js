// Server - Main Express application
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './logger.js';
import memory from './memory.js';
import safety from './safety.js';
import aiEngine from './aiEngine.js';
import twilioService from './twilio.js';
import messageHandler from './messageHandler.js';
import checkins from './checkins.js';
import sessionManager from './sessionManager.js';
import { mkdirSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Middleware
app.use(helmet()); // Security headers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// User-specific rate limiting (more restrictive)
const userRateLimits = new Map();

function checkUserRateLimit(phoneNumber) {
  const now = Date.now();
  const hourLimit = parseInt(process.env.RATE_LIMIT_HOUR || '20');
  const hourWindow = 60 * 60 * 1000; // 1 hour

  if (!userRateLimits.has(phoneNumber)) {
    userRateLimits.set(phoneNumber, []);
  }

  const userRequests = userRateLimits.get(phoneNumber);

  // Remove old requests outside the window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < hourWindow);

  userRateLimits.set(phoneNumber, recentRequests);

  if (recentRequests.length >= hourLimit) {
    return false;
  }

  recentRequests.push(now);
  return true;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const stats = sessionManager.getStatistics();

  res.json({
    status: 'operational',
    activeSessions: stats.activeSessions,
    timestamp: new Date().toISOString(),
  });
});

// Twilio webhook endpoint for incoming SMS
app.post('/webhook/sms', async (req, res) => {
  try {
    // Validate webhook (in production)
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers['x-twilio-signature'];
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      const isValid = twilioService.validateWebhook(signature, url, req.body);

      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return res.status(403).send('Forbidden');
      }
    }

    // Parse incoming message
    const incomingMessage = twilioService.parseIncomingMessage(req.body);
    const { from, message } = incomingMessage;

    logger.info('Incoming SMS received', {
      from: from.slice(-4),
      messageLength: message.length,
    });

    // Check user rate limit
    if (!checkUserRateLimit(from)) {
      logger.warn('User rate limit exceeded', { from: from.slice(-4) });

      const limitMessage = `You've reached the hourly message limit. This helps ensure I can support everyone effectively. Please try again in a bit, or call 988 if you need immediate help.`;

      await twilioService.sendSMS(from, limitMessage);
      return res.status(200).send('OK');
    }

    // Validate message
    const validation = messageHandler.validateMessage(message);

    if (!validation.valid) {
      logger.warn('Invalid message received', { from: from.slice(-4), reason: validation.reason });
      return res.status(200).send('OK');
    }

    // Handle media messages (not supported yet)
    if (incomingMessage.numMedia > 0) {
      const mediaResponse = `I can only process text messages right now. If you need immediate help with something urgent, please call 988 or text "HELP" to 741741.`;

      await twilioService.sendSMS(from, mediaResponse);
      return res.status(200).send('OK');
    }

    // Process message asynchronously
    setImmediate(async () => {
      try {
        await messageHandler.handleIncomingMessage(from, message);
      } catch (error) {
        logger.logError(error, { from: from.slice(-4), context: 'async message handling' });
      }
    });

    // Respond immediately to Twilio (required within 15 seconds)
    res.status(200).send('OK');
  } catch (error) {
    logger.logError(error, { context: 'webhook/sms' });
    res.status(500).send('Internal Server Error');
  }
});

// Manual check-in endpoint (for admin use)
app.post('/api/checkin/run', async (req, res) => {
  try {
    // In production, you'd want authentication here
    const result = await checkins.runCheckIns();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.logError(error, { context: 'api/checkin/run' });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Send message endpoint (for testing)
app.post('/api/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message',
      });
    }

    const result = await twilioService.sendSMS(to, message);

    res.json(result);
  } catch (error) {
    logger.logError(error, { context: 'api/send' });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get conversation history endpoint (for admin/testing)
app.get('/api/conversation/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const limit = parseInt(req.query.limit || '20');

    const history = await memory.getConversationHistory(phoneNumber, limit);
    const profile = await memory.getUserProfile(phoneNumber);

    res.json({
      success: true,
      phoneNumber: phoneNumber.slice(-4), // Only show last 4 digits
      profile,
      history,
    });
  } catch (error) {
    logger.logError(error, { context: 'api/conversation' });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint to check crisis detection
app.post('/api/test/crisis', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing message field',
      });
    }

    const assessment = safety.assessRisk(message);

    res.json({
      success: true,
      assessment,
    });
  } catch (error) {
    logger.logError(error, { context: 'api/test/crisis' });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.logError(err, { context: 'express error handler' });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Initialize application
async function initialize() {
  try {
    logger.info('Initializing application...');

    // Validate configurations
    const configsValid = [
      safety.validateSafetyConfiguration(),
      aiEngine.validateConfiguration(),
      twilioService.validateConfiguration(),
    ].every(Boolean);

    if (!configsValid) {
      throw new Error('Configuration validation failed');
    }

    // Initialize database
    await memory.initialize();

    // Initialize check-ins
    checkins.initializeCheckIns();

    // Session cleanup every hour
    setInterval(() => {
      sessionManager.cleanupSessions();
    }, 60 * 60 * 1000);

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.logError(error, { context: 'initialization' });
    throw error;
  }
}

// Start server
async function start() {
  try {
    await initialize();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Webhook URL: http://localhost:${PORT}/webhook/sms`);
      console.log(`\n=€ Mental Health Support Bot is running!`);
      console.log(`=ñ Webhook: http://localhost:${PORT}/webhook/sms`);
      console.log(`=š Health: http://localhost:${PORT}/health`);
      console.log(`\n   IMPORTANT: Make sure to configure your Twilio webhook to point to this URL\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  checkins.stopCheckIns();
  await memory.cleanup();

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  checkins.stopCheckIns();
  await memory.cleanup();

  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start the server
start();

export default app;
