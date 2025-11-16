// AI Engine - Claude-powered conversational AI for mental health support
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import logger from './logger.js';
import sessionManager from './sessionManager.js';

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for mental health support
const SYSTEM_PROMPT = `You are a compassionate mental health support chatbot designed specifically for teenagers. Your role is to provide empathetic, supportive, and age-appropriate guidance.

CORE PRINCIPLES:
1. Be warm, empathetic, and non-judgmental
2. Use teen-friendly language (avoid clinical jargon)
3. Validate their feelings and experiences
4. Never diagnose or prescribe medication
5. Always prioritize safety
6. Encourage professional help when appropriate
7. Respect confidentiality while maintaining safety protocols

COMMUNICATION STYLE:
- Keep responses concise (SMS-friendly, 2-4 sentences usually)
- Use a friendly, supportive tone
- Ask open-ended questions to encourage sharing
- Reflect their emotions back to show understanding
- Avoid sounding preachy or lecturing
- Use "I" statements ("I hear that..." rather than "You should...")

SAFETY PROTOCOLS:
- If someone expresses suicidal thoughts, self-harm, or abuse, prioritize their immediate safety
- Provide crisis resources when needed (988, Crisis Text Line)
- Encourage them to talk to trusted adults
- Never dismiss or minimize serious concerns
- Document high-risk interactions for professional review

BOUNDARIES:
- You are a support tool, not a replacement for therapy
- Encourage professional help for ongoing concerns
- Don't provide medical advice
- Don't make promises you can't keep
- Respect if they don't want to share something

TOPICS YOU HELP WITH:
- Stress and anxiety
- Depression and sadness
- Friendship and relationship issues
- Family conflicts
- School pressure and academic stress
- Self-esteem and identity
- LGBTQ+ concerns
- Bullying
- Loneliness and isolation
- General emotional support

Remember: You're here to listen, support, and guide them toward appropriate resources. Every conversation matters.`;

/**
 * Generate AI response based on user message and context
 */
export async function generateResponse(userMessage, phoneNumber, context = {}) {
  try {
    const startTime = Date.now();

    // Build conversation history for context
    const messages = await buildConversationMessages(userMessage, context);

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500, // Keep responses concise for SMS
      temperature: 0.7,
      system: buildSystemPrompt(context),
      messages: messages,
    });

    const duration = Date.now() - startTime;

    // Log API call
    logger.logAPICall('anthropic', 'messages.create', duration, 'success');

    const assistantMessage = response.content[0].text;

    // Ensure response is SMS-friendly (split if too long)
    const finalResponse = ensureSMSFriendly(assistantMessage);

    return {
      success: true,
      message: finalResponse,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    logger.logError(error, { phoneNumber, userMessage: userMessage.substring(0, 50) });

    return {
      success: false,
      message: getFallbackResponse(context),
      error: error.message,
    };
  }
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context) {
  let prompt = SYSTEM_PROMPT;

  if (context.isFirstTime) {
    prompt += `\n\nCONTEXT: This is the user's first message. Introduce yourself warmly and ask how you can help.`;
  }

  if (context.riskLevel && context.riskLevel !== 'none') {
    prompt += `\n\nALERT: This user has shown signs of ${context.riskLevel} risk. Be extra supportive and watch for crisis indicators.`;
  }

  if (context.currentTopic) {
    prompt += `\n\nCONTEXT: Current conversation topic is "${context.currentTopic}".`;
  }

  if (context.mood) {
    prompt += `\n\nCONTEXT: User's recent mood seems to be: ${context.mood}.`;
  }

  if (context.flags?.inCrisis) {
    prompt += `\n\nALERT: User may be in crisis. Continue providing support and encourage professional help.`;
  }

  return prompt;
}

/**
 * Build conversation messages for API
 */
async function buildConversationMessages(currentMessage, context) {
  const messages = [];

  // Add recent conversation history
  if (context.recentMessages && context.recentMessages.length > 0) {
    context.recentMessages.forEach(msg => {
      messages.push({ role: 'user', content: msg.user });
      messages.push({ role: 'assistant', content: msg.assistant });
    });
  }

  // Add current message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

/**
 * Ensure response is SMS-friendly (max 1600 chars)
 */
function ensureSMSFriendly(message) {
  const MAX_SMS_LENGTH = 1600;

  if (message.length <= MAX_SMS_LENGTH) {
    return message;
  }

  // Split at sentence boundaries
  const sentences = message.match(/[^.!?]+[.!?]+/g) || [message];
  let result = '';

  for (const sentence of sentences) {
    if ((result + sentence).length <= MAX_SMS_LENGTH - 50) {
      result += sentence;
    } else {
      break;
    }
  }

  // Add continuation message
  result += '\n\n(Message continued in next text)';

  return result.trim();
}

/**
 * Get fallback response when AI fails
 */
function getFallbackResponse(context) {
  if (context.flags?.inCrisis) {
    return `I'm having trouble responding right now, but I want to make sure you're safe. Please reach out:\n\n=Þ Call 988 (Suicide & Crisis Lifeline)\n=¬ Text "HELLO" to 741741\n\nThese are free and available 24/7.`;
  }

  return `I'm having a moment of technical difficulty, but I'm here for you. Could you tell me again what's on your mind? If you need immediate help, call 988 or text "HELLO" to 741741.`;
}

/**
 * Generate a wellness check-in message
 */
export function generateCheckInMessage(userProfile) {
  const checkIns = [
    `Hey! Just checking in to see how you're doing today. How are things going?`,
    `Hi there! I was thinking about you. How have you been feeling lately?`,
    `Hey! It's been a little while. How's everything been going for you?`,
    `Hi! Just wanted to reach out and see how you're doing. What's new with you?`,
    `Hey! Hope you're having a good day. How are you feeling today?`,
  ];

  // Personalize based on risk level
  if (userProfile?.risk_level === 'high' || userProfile?.risk_level === 'critical') {
    return `Hey, I wanted to check in and see how you've been doing. I care about you and want to make sure you're okay. How are you feeling?`;
  }

  if (userProfile?.risk_level === 'medium') {
    return `Hi! Just checking in on you. How have things been going lately? I'm here if you want to talk.`;
  }

  // Random check-in for low/no risk
  return checkIns[Math.floor(Math.random() * checkIns.length)];
}

/**
 * Analyze message sentiment (basic implementation)
 */
export function analyzeSentiment(message) {
  const lowerMessage = message.toLowerCase();

  const positiveWords = ['good', 'great', 'happy', 'better', 'okay', 'fine', 'thanks', 'grateful'];
  const negativeWords = ['bad', 'sad', 'terrible', 'awful', 'horrible', 'depressed', 'anxious', 'worried'];
  const neutralWords = ['okay', 'fine', 'alright'];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) positiveCount++;
  });

  negativeWords.forEach(word => {
    if (lowerMessage.includes(word)) negativeCount++;
  });

  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > negativeCount) return 'positive';
  return 'neutral';
}

/**
 * Extract topic from message (basic implementation)
 */
export function extractTopic(message) {
  const lowerMessage = message.toLowerCase();

  const topics = {
    school: ['school', 'class', 'homework', 'teacher', 'grade', 'test', 'exam', 'college'],
    family: ['mom', 'dad', 'parent', 'family', 'brother', 'sister', 'sibling', 'home'],
    friends: ['friend', 'friendship', 'peer', 'classmate', 'people'],
    relationship: ['boyfriend', 'girlfriend', 'dating', 'relationship', 'crush', 'love'],
    anxiety: ['anxious', 'anxiety', 'worried', 'nervous', 'panic', 'stress', 'overwhelmed'],
    depression: ['depressed', 'sad', 'depression', 'hopeless', 'empty', 'numb'],
    selfEsteem: ['ugly', 'fat', 'worthless', 'hate myself', 'insecure', 'confidence'],
    bullying: ['bully', 'bullying', 'teasing', 'mean', 'picking on'],
    lgbtq: ['gay', 'lesbian', 'trans', 'queer', 'lgbtq', 'coming out', 'sexuality', 'gender'],
  };

  for (const [topic, keywords] of Object.entries(topics)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return topic;
      }
    }
  }

  return 'general';
}

/**
 * Generate greeting message for new users
 */
export function generateGreeting() {
  return `Hi! I'm here to listen and support you through whatever you're going through. You can talk to me about anything - stress, school, friends, family, or just how you're feeling.\n\nEverything we discuss is confidential, and there's no judgment here. What's on your mind today?`;
}

/**
 * Validate API key is configured
 */
export function validateConfiguration() {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error('ANTHROPIC_API_KEY not configured');
    return false;
  }

  logger.info('AI Engine configured successfully');
  return true;
}

export default {
  generateResponse,
  generateCheckInMessage,
  analyzeSentiment,
  extractTopic,
  generateGreeting,
  validateConfiguration,
};
