// Twilio Module - SMS integration
import twilio from 'twilio';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient;

/**
 * Initialize Twilio client
 */
export function initializeTwilio() {
  try {
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      logger.error('Twilio credentials not configured');
      return false;
    }

    twilioClient = twilio(accountSid, authToken);
    logger.info('Twilio client initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Twilio', { error: error.message });
    return false;
  }
}

/**
 * Send SMS message
 */
export async function sendSMS(to, message) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to,
    });

    logger.logConversation(to, message, false);
    logger.info('SMS sent successfully', {
      to: to.slice(-4),
      messageSid: result.sid,
      status: result.status,
    });

    return {
      success: true,
      messageSid: result.sid,
      status: result.status,
    };
  } catch (error) {
    logger.logError(error, { to, context: 'sendSMS' });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send multiple SMS messages (for long responses)
 */
export async function sendMultipleSMS(to, messages) {
  const results = [];

  for (const message of messages) {
    const result = await sendSMS(to, message);
    results.push(result);

    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Validate Twilio webhook signature
 */
export function validateWebhook(signature, url, params) {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret || webhookSecret === 'your_webhook_secret_here') {
      logger.warn('Webhook secret not configured - validation skipped');
      return true; // Allow in development
    }

    return twilio.validateRequest(authToken, signature, url, params);
  } catch (error) {
    logger.error('Webhook validation failed', { error: error.message });
    return false;
  }
}

/**
 * Parse incoming Twilio webhook
 */
export function parseIncomingMessage(body) {
  return {
    from: body.From,
    to: body.To,
    message: body.Body,
    messageSid: body.MessageSid,
    accountSid: body.AccountSid,
    numMedia: parseInt(body.NumMedia || '0'),
  };
}

/**
 * Format Twilio webhook response (TwiML)
 */
export function formatWebhookResponse(message = null) {
  const twiml = new twilio.twiml.MessagingResponse();

  if (message) {
    twiml.message(message);
  }

  return twiml.toString();
}

/**
 * Get message status
 */
export async function getMessageStatus(messageSid) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const message = await twilioClient.messages(messageSid).fetch();

    return {
      success: true,
      status: message.status,
      to: message.to,
      from: message.from,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };
  } catch (error) {
    logger.error('Failed to get message status', { error: error.message, messageSid });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send immediate crisis response via SMS
 */
export async function sendCrisisResponse(to, resources) {
  const message = `=¨ CRISIS RESOURCES =¨\n\n` +
    `If you're in immediate danger, call 911.\n\n` +
    `24/7 Crisis Support:\n` +
    `=Þ 988 - Suicide & Crisis Lifeline\n` +
    `=¬ Text HELLO to 741741 - Crisis Text Line\n\n` +
    `You're not alone. Help is available right now.`;

  return await sendSMS(to, message);
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber) {
  // Basic validation for E.164 format
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneNumber(phoneNumber) {
  // Remove all non-numeric characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Add +1 for US numbers if not present
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }

  // Add + prefix
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Validate configuration
 */
export function validateConfiguration() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error('Missing Twilio configuration', { missing });
    return false;
  }

  if (!validatePhoneNumber(twilioPhoneNumber)) {
    logger.error('Invalid Twilio phone number format', { number: twilioPhoneNumber });
    return false;
  }

  logger.info('Twilio configuration validated successfully');
  return true;
}

// Initialize on module load
initializeTwilio();

export default {
  initializeTwilio,
  sendSMS,
  sendMultipleSMS,
  validateWebhook,
  parseIncomingMessage,
  formatWebhookResponse,
  getMessageStatus,
  sendCrisisResponse,
  validatePhoneNumber,
  formatPhoneNumber,
  validateConfiguration,
};
