import { sendSMS } from './twilio.js';
import { checkCrisis } from './safetyClassifier.js';
import { generateAIResponse } from './aiEngine.js';
import { getContext, saveContext } from './sessionManager.js';
import { checkRateLimit } from './rateLimiter.js';
import { logger } from './logger.js';

const CRISIS_MESSAGE = `I'm really glad you reached out. I'm not able to help with situations of self-harm or danger, but you're not alone. You can contact the 988 Lifeline or text 'HOME' to 741741 to talk to someone right now. If you can, please reach out to a trusted adult near you.`;

export async function handleIncomingMessage(phoneNumber, messageBody, messageId) {
  try {
    // Input validation
    if (!messageBody || messageBody.trim().length === 0) {
      logger.warn('Empty message received', { messageId });
      return;
    }

    if (!phoneNumber) {
      logger.error('No phone number provided', { messageId });
      return;
    }

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(phoneNumber);
    if (!rateLimitResult.allowed) {
      await sendSMS(
        phoneNumber, 
        "You've reached the message limit for now. Please try again later or call 988 if you need immediate support."
      );
      logger.warn('Rate limit exceeded', { 
        phoneNumber: phoneNumber.slice(-4),
        limit: rateLimitResult.limit 
      });
      return;
    }

    // Safety check - HIGHEST PRIORITY
    const crisisDetected = await checkCrisis(messageBody);
    
    if (crisisDetected.isCrisis) {
      logger.error('CRISIS DETECTED', {
        phoneNumber: phoneNumber.slice(-4),
        messageId,
        reason: crisisDetected.reason,
        keyword: crisisDetected.keyword || 'N/A',
        timestamp: new Date().toISOString()
      });
      
      await sendSMS(phoneNumber, CRISIS_MESSAGE);
      
      // Save crisis event (for audit)
      await saveContext(phoneNumber, {
        user: messageBody,
        assistant: CRISIS_MESSAGE,
        timestamp: Date.now(),
        crisis: true
      });
      
      return;
    }

    // Load conversation context
    const context = await getContext(phoneNumber);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(messageBody, context);
    
    // Save to context
    await saveContext(phoneNumber, {
      user: messageBody,
      assistant: aiResponse,
      timestamp: Date.now()
    });
    
    // Send response
    await sendSMS(phoneNumber, aiResponse);
    
    logger.info('Message processed successfully', {
      messageId,
      responseLength: aiResponse.length,
      contextSize: context.length
    });
    
  } catch (error) {
    logger.error('Message handler error', {
      error: error.message,
      stack: error.stack,
      messageId
    });
    
    // Fallback response
    try {
      await sendSMS(
        phoneNumber,
        "I'm having trouble right now. If you need immediate support, please call 988."
      );
    } catch (sendError) {
      logger.error('Failed to send error message', { error: sendError.message });
    }
  }
}