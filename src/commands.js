// Commands Module - Handle special user commands
import safety from './safety.js';
import logger from './logger.js';

/**
 * Check if message is a command
 */
export function isCommand(message) {
  const lowerMessage = message.trim().toLowerCase();
  return lowerMessage.startsWith('/') ||
         lowerMessage === 'help' ||
         lowerMessage === 'resources' ||
         lowerMessage === 'crisis' ||
         lowerMessage === 'stop';
}

/**
 * Parse and execute command
 */
export async function handleCommand(message, phoneNumber) {
  const lowerMessage = message.trim().toLowerCase();

  // Remove leading slash if present
  const commandText = lowerMessage.startsWith('/') ? lowerMessage.slice(1) : lowerMessage;

  switch (commandText) {
    case 'help':
      return getHelpMessage();

    case 'resources':
    case 'crisis':
      return getCrisisResourcesMessage();

    case 'safetyplan':
    case 'safety plan':
    case 'safety':
      return safety.getSafetyPlanPrompt();

    case 'topics':
      return getTopicsMessage();

    case 'about':
      return getAboutMessage();

    case 'stop':
    case 'unsubscribe':
      return getStopMessage();

    case 'start':
    case 'resume':
      return getResumeMessage();

    case 'checkin':
    case 'check in':
    case 'check-in':
      return getCheckInResponse();

    case 'breathe':
    case 'breathing':
      return getBreathingExercise();

    case 'grounding':
    case 'ground':
      return getGroundingExercise();

    case 'coping':
      return getCopingStrategies();

    default:
      // Unknown command
      return `I don't recognize that command. Text "help" to see available commands.`;
  }
}

/**
 * Get help message
 */
function getHelpMessage() {
  return `Available commands:\n\n` +
    `" HELP - Show this message\n` +
    `" RESOURCES - Crisis hotlines & support\n` +
    `" SAFETYPLAN - Create a safety plan\n` +
    `" TOPICS - What I can help with\n` +
    `" BREATHE - Breathing exercise\n` +
    `" GROUNDING - Grounding technique\n` +
    `" COPING - Coping strategies\n` +
    `" ABOUT - Learn about this service\n` +
    `" STOP - Pause messages\n\n` +
    `Or just text me anything you want to talk about!`;
}

/**
 * Get crisis resources message
 */
function getCrisisResourcesMessage() {
  return `<˜ CRISIS RESOURCES <˜\n\n` +
    `If you're in immediate danger, call 911.\n\n` +
    `24/7 Free & Confidential Support:\n\n` +
    `=Þ 988 - Suicide & Crisis Lifeline\n` +
    `=¬ Text "HELLO" to 741741 - Crisis Text Line\n` +
    `< 1-866-488-7386 - Trevor Project (LGBTQ+ Youth)\n` +
    `=h=i=g 1-800-422-4453 - Childhelp (Abuse Hotline)\n` +
    `>à 1-800-662-4357 - SAMHSA (Substance Abuse)\n\n` +
    `You're not alone. These people care and want to help.`;
}

/**
 * Get topics message
 */
function getTopicsMessage() {
  return `I'm here to help with:\n\n` +
    `" Stress & anxiety\n` +
    `" Feeling sad or depressed\n` +
    `" Friend & relationship issues\n` +
    `" Family problems\n` +
    `" School pressure\n` +
    `" Self-esteem & confidence\n` +
    `" LGBTQ+ concerns\n` +
    `" Bullying\n` +
    `" Loneliness\n` +
    `" Or anything else on your mind\n\n` +
    `What would you like to talk about?`;
}

/**
 * Get about message
 */
function getAboutMessage() {
  return `I'm a mental health support chatbot created to help teenagers navigate life's challenges.\n\n` +
    `What I do:\n` +
    `" Provide a safe space to talk\n` +
    `" Offer emotional support\n` +
    `" Share coping strategies\n` +
    `" Connect you with professional resources\n\n` +
    `What I don't do:\n` +
    `" Diagnose conditions\n` +
    `" Prescribe medication\n` +
    `" Replace therapy or counseling\n\n` +
    `Everything you share is confidential. I'm here to listen, support, and help you find the resources you need.`;
}

/**
 * Get stop message
 */
function getStopMessage() {
  return `I understand. I'll pause sending you messages.\n\n` +
    `If you ever want to talk again, just text "START" or message me anytime.\n\n` +
    `Remember: If you're in crisis, help is always available at 988 or text "HELLO" to 741741.\n\n` +
    `Take care of yourself. =™`;
}

/**
 * Get resume message
 */
function getResumeMessage() {
  return `Welcome back! I'm glad you're here. =™\n\n` +
    `How have you been? Is there anything you'd like to talk about?`;
}

/**
 * Get check-in response
 */
function getCheckInResponse() {
  return `Thanks for checking in! How are you feeling right now?\n\n` +
    `You can rate your mood 1-10, or just tell me what's going on.`;
}

/**
 * Get breathing exercise
 */
function getBreathingExercise() {
  return `Let's do a quick breathing exercise together:\n\n` +
    `1ã Breathe IN slowly for 4 seconds\n` +
    `2ã HOLD for 4 seconds\n` +
    `3ã Breathe OUT slowly for 4 seconds\n` +
    `4ã HOLD for 4 seconds\n\n` +
    `Repeat 3-5 times.\n\n` +
    `How are you feeling now?`;
}

/**
 * Get grounding exercise (5-4-3-2-1 technique)
 */
function getGroundingExercise() {
  return `Let's try the 5-4-3-2-1 grounding technique:\n\n` +
    `Name out loud:\n` +
    `5 things you can SEE\n` +
    `4 things you can TOUCH\n` +
    `3 things you can HEAR\n` +
    `2 things you can SMELL\n` +
    `1 thing you can TASTE\n\n` +
    `Take your time. This helps bring you back to the present moment.\n\n` +
    `How do you feel after trying this?`;
}

/**
 * Get coping strategies
 */
function getCopingStrategies() {
  return `Healthy ways to cope when things get tough:\n\n` +
    `" Talk to someone you trust\n` +
    `" Write in a journal\n` +
    `" Listen to music\n` +
    `" Go for a walk\n` +
    `" Do breathing exercises (text BREATHE)\n` +
    `" Pet an animal\n` +
    `" Take a shower\n` +
    `" Draw or be creative\n` +
    `" Watch something funny\n` +
    `" Practice self-compassion\n\n` +
    `What usually helps you feel better?`;
}

/**
 * Get list of all commands
 */
export function getCommandList() {
  return [
    'help',
    'resources',
    'crisis',
    'safetyplan',
    'safety plan',
    'safety',
    'topics',
    'about',
    'stop',
    'unsubscribe',
    'start',
    'resume',
    'checkin',
    'check in',
    'check-in',
    'breathe',
    'breathing',
    'grounding',
    'ground',
    'coping',
  ];
}

export default {
  isCommand,
  handleCommand,
  getCommandList,
  getHelpMessage,
  getCrisisResourcesMessage,
  getBreathingExercise,
  getGroundingExercise,
  getCopingStrategies,
};
