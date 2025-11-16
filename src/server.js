import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { handleIncomingMessage } from './messageHandler.js';
import { logger } from './logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'calmtext'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    service: 'CalmText',
    version: '1.0.0',
    status: 'running'
  });
});

// Twilio webhook endpoint
app.post('/sms/webhook', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    logger.info('Received SMS', { 
      from: From?.slice(-4),
      messageId: MessageSid 
    });

    // Validate Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const twilioSignature = req.headers['x-twilio-signature'];
      const url = `https://${req.headers.host}${req.url}`;
      
      if (!twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        req.body
      )) {
        logger.warn('Invalid Twilio signature');
        return res.status(403).send('Forbidden');
      }
    }

    // Process message asynchronously
    handleIncomingMessage(From, Body, MessageSid)
      .catch(err => logger.error('Message handling error', { error: err.message }));

    // Respond immediately to Twilio
    res.status(200).send('');
    
  } catch (error) {
    logger.error('Webhook error', { error: error.message });
    res.status(500).send('');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`CalmText server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;