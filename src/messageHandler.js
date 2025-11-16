// Message Handler - Central message routing and processing
import safety from './safety.js';
import aiEngine from './aiEngine.js';
import commands from './commands.js';
import sessionManager from './sessionManager.js';
import memory from './memory.js';
import twilioService from './twilio.js';
import logger from './logger.js';

/**
 * Main message handling function
 */
export async function handleIncomingMessage(phoneNumber, messageText) {
  try {
    logger.logConversation(phoneNumber, messageText, true);

    // Get user session and context
    const context = await sessionManager.getContextForAI(phoneNumber);

    // Check if it's a command
    if (commands.isCommand(messageText)) {
      const commandResponse = await commands.handleCommand(messageText, phoneNumber);

      // Store command interaction
      await memory.storeMessage(phoneNumber, messageText, 'incoming', 'none', []);
      await memory.storeMessage(phoneNumber, commandResponse, 'outgoing', 'none', []);

      // Send response
      await twilioService.sendSMS(phoneNumber, commandResponse);

      logger.info('Command processed', {
        phoneNumber: phoneNumber.slice(-4),
        command: messageText,
      });

      return {
        success: true,
        response: commandResponse,
        type: 'command',
      };
    }

    // Assess risk level
    const riskAssessment = safety.assessRisk(messageText);

    // Log crisis events
    if (safety.requiresHumanEscalation(riskAssessment)) {
      await memory.storeCrisisEvent(phoneNumber, riskAssessment, messageText.substring(0, 100));
      logger.logCrisis(phoneNumber, riskAssessment);
    }

    let response;

    // Handle crisis situations with immediate intervention
    if (riskAssessment.level === 'critical' || riskAssessment.level === 'high') {
      // Send immediate crisis response
      const crisisResponse = safety.generateCrisisResponse(riskAssessment);

      // Store crisis interaction
      await memory.storeMessage(
        phoneNumber,
        messageText,
        'incoming',
        riskAssessment.level,
        riskAssessment.categories
      );

      await memory.storeMessage(
        phoneNumber,
        crisisResponse,
        'outgoing',
        riskAssessment.level,
        riskAssessment.categories
      );

      // Send crisis resources
      await twilioService.sendSMS(phoneNumber, crisisResponse);

      // Also get AI response for continued support (send after crisis message)
      const aiResponse = await aiEngine.generateResponse(messageText, phoneNumber, {
        ...context,
        riskLevel: riskAssessment.level,
        flags: { ...context.flags, inCrisis: true },
      });

      if (aiResponse.success) {
        await twilioService.sendSMS(phoneNumber, aiResponse.message);
        await memory.storeMessage(
          phoneNumber,
          aiResponse.message,
          'outgoing',
          riskAssessment.level,
          riskAssessment.categories
        );
      }

      // Update session
      await sessionManager.updateContext(
        phoneNumber,
        messageText,
        crisisResponse + '\n\n' + (aiResponse.success ? aiResponse.message : ''),
        riskAssessment
      );

      response = crisisResponse;

    } else {
      // Normal conversation flow with AI
      const aiResponse = await aiEngine.generateResponse(messageText, phoneNumber, context);

      if (!aiResponse.success) {
        logger.error('AI response generation failed', {
          phoneNumber: phoneNumber.slice(-4),
          error: aiResponse.error,
        });

        response = aiResponse.message; // Fallback message
      } else {
        response = aiResponse.message;
      }

      // Store conversation
      await memory.storeMessage(
        phoneNumber,
        messageText,
        'incoming',
        riskAssessment.level,
        riskAssessment.categories
      );

      await memory.storeMessage(
        phoneNumber,
        response,
        'outgoing',
        riskAssessment.level,
        riskAssessment.categories
      );

      // Send response
      await twilioService.sendSMS(phoneNumber, response);

      // Update session
      await sessionManager.updateContext(phoneNumber, messageText, response, riskAssessment);

      // Extract and store conversation metadata
      const sentiment = aiEngine.analyzeSentiment(messageText);
      const topic = aiEngine.extractTopic(messageText);

      await sessionManager.updateMood(phoneNumber, sentiment);
      await sessionManager.setTopic(phoneNumber, topic);
    }

    return {
      success: true,
      response: response,
      riskLevel: riskAssessment.level,
      type: 'conversation',
    };
  } catch (error) {
    logger.logError(error, {
      phoneNumber: phoneNumber.slice(-4),
      context: 'handleIncomingMessage',
    });

    // Send fallback error message
    const errorMessage = `I'm having technical difficulties right now. If you need immediate help, please call 988 or text "HELLO" to 741741. I'll try to respond to your message again shortly.`;

    try {
      await twilioService.sendSMS(phoneNumber, errorMessage);
    } catch (sendError) {
      logger.error('Failed to send error message', { error: sendError.message });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle first-time user
 */
export async function handleNewUser(phoneNumber) {
  try {
    const greeting = aiEngine.generateGreeting();

    await memory.storeMessage(phoneNumber, greeting, 'outgoing', 'none', []);
    await twilioService.sendSMS(phoneNumber, greeting);

    logger.info('New user greeted', { phoneNumber: phoneNumber.slice(-4) });

    return {
      success: true,
      response: greeting,
    };
  } catch (error) {
    logger.logError(error, { phoneNumber: phoneNumber.slice(-4), context: 'handleNewUser' });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send proactive check-in
 */
export async function sendCheckIn(phoneNumber, userProfile = null) {
  try {
    const checkInMessage = aiEngine.generateCheckInMessage(userProfile);

    await memory.recordCheckIn(phoneNumber);
    await memory.storeMessage(phoneNumber, checkInMessage, 'outgoing', 'none', []);
    await twilioService.sendSMS(phoneNumber, checkInMessage);

    logger.info('Check-in sent', { phoneNumber: phoneNumber.slice(-4) });

    return {
      success: true,
      message: checkInMessage,
    };
  } catch (error) {
    logger.logError(error, { phoneNumber: phoneNumber.slice(-4), context: 'sendCheckIn' });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle check-in response
 */
export async function handleCheckInResponse(phoneNumber, messageText) {
  try {
    await memory.recordCheckInResponse(phoneNumber, messageText);

    // Process as normal message
    return await handleIncomingMessage(phoneNumber, messageText);
  } catch (error) {
    logger.logError(error, {
      phoneNumber: phoneNumber.slice(-4),
      context: 'handleCheckInResponse',
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process message queue (for batch processing)
 */
export async function processMessageQueue(messages) {
  const results = [];

  for (const msg of messages) {
    const result = await handleIncomingMessage(msg.phoneNumber, msg.messageText);
    results.push({ ...msg, ...result });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Validate message before processing
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, reason: 'Invalid message format' };
  }

  if (message.trim().length === 0) {
    return { valid: false, reason: 'Empty message' };
  }

  if (message.length > 10000) {
    return { valid: false, reason: 'Message too long' };
  }

  return { valid: true };
}

export default {
  handleIncomingMessage,
  handleNewUser,
  sendCheckIn,
  handleCheckInResponse,
  processMessageQueue,
  validateMessage,
};
