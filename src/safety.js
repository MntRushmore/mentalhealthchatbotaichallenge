// Safety Module - Crisis Detection and Intervention
// This module handles mental health crisis detection and emergency protocols

import logger from './logger.js';

// Crisis Keywords and Patterns
const CRISIS_KEYWORDS = {
  suicide: [
    'kill myself', 'end my life', 'want to die', 'suicide', 'suicidal',
    'better off dead', 'no reason to live', 'ending it all', 'take my life',
    'not worth living', 'end it all', 'rather be dead', 'wish i was dead',
    'going to kill', 'planning to die', 'goodbye forever', 'final goodbye',
    'cant go on', "can't take it anymore", 'overdose', 'hang myself',
    'jump off', 'slit my wrist', 'end this pain', 'everyone would be better',
  ],
  selfHarm: [
    'cut myself', 'cutting', 'self harm', 'self-harm', 'hurt myself',
    'burning myself', 'punish myself', 'deserve pain', 'harm myself',
    'mutilate', 'starve myself', 'stop eating', 'purge', 'make myself bleed',
  ],
  abuse: [
    'being abused', 'molested', 'sexual abuse', 'physically abused',
    'hit me', 'beats me', 'touches me inappropriately', 'rape', 'raped',
    'assaulted', 'hurts me', 'scared of', 'threatens me', 'hitting me',
  ],
  substance: [
    'overdosing', 'too many pills', 'drinking to forget', 'getting high',
    'need drugs', 'cant stop using', 'addicted', 'substance abuse',
    'alcohol problem', 'drug problem', 'taking pills', 'using drugs',
  ],
  immediateRisk: [
    'right now', 'tonight', 'today', 'have the', 'holding', 'in my hand',
    'ready to', 'about to', 'going to do it', 'this is goodbye',
    'saying goodbye', 'last message', 'final text', 'wont respond',
  ],
};

// Crisis Resources
export const CRISIS_RESOURCES = {
  suicide: {
    name: '988 Suicide & Crisis Lifeline',
    number: '988',
    text: 'Text "HELLO" to 741741',
    description: '24/7 free and confidential support',
  },
  crisisText: {
    name: 'Crisis Text Line',
    number: '741741',
    text: 'Text "HELLO"',
    description: 'Free 24/7 crisis support via text',
  },
  trevorProject: {
    name: 'Trevor Project (LGBTQ+ Youth)',
    number: '1-866-488-7386',
    text: 'Text "START" to 678-678',
    description: 'Suicide prevention for LGBTQ+ youth',
  },
  abuse: {
    name: 'Childhelp National Abuse Hotline',
    number: '1-800-422-4453',
    description: 'Support for abuse victims',
  },
  samhsa: {
    name: 'SAMHSA Helpline (Substance Abuse)',
    number: '1-800-662-4357',
    description: 'Substance abuse and mental health services',
  },
  eating: {
    name: 'NEDA Hotline (Eating Disorders)',
    number: '1-800-931-2237',
    text: 'Text "NEDA" to 741741',
    description: 'Support for eating disorders',
  },
};

// Risk Levels
export const RISK_LEVELS = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Analyzes message content for crisis indicators
 * @param {string} message - User's message
 * @returns {Object} - Risk assessment result
 */
export function assessRisk(message) {
  const lowerMessage = message.toLowerCase();
  const assessment = {
    level: RISK_LEVELS.NONE,
    categories: [],
    keywords: [],
    requiresImmediateIntervention: false,
    resources: [],
  };

  let riskScore = 0;

  // Check for suicide risk
  const suicideMatches = CRISIS_KEYWORDS.suicide.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  if (suicideMatches.length > 0) {
    assessment.categories.push('suicide');
    assessment.keywords.push(...suicideMatches);
    riskScore += suicideMatches.length * 10;
    assessment.resources.push(CRISIS_RESOURCES.suicide, CRISIS_RESOURCES.crisisText);
  }

  // Check for self-harm
  const selfHarmMatches = CRISIS_KEYWORDS.selfHarm.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  if (selfHarmMatches.length > 0) {
    assessment.categories.push('selfHarm');
    assessment.keywords.push(...selfHarmMatches);
    riskScore += selfHarmMatches.length * 7;
    assessment.resources.push(CRISIS_RESOURCES.crisisText);
  }

  // Check for abuse
  const abuseMatches = CRISIS_KEYWORDS.abuse.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  if (abuseMatches.length > 0) {
    assessment.categories.push('abuse');
    assessment.keywords.push(...abuseMatches);
    riskScore += abuseMatches.length * 8;
    assessment.resources.push(CRISIS_RESOURCES.abuse);
  }

  // Check for substance abuse
  const substanceMatches = CRISIS_KEYWORDS.substance.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  if (substanceMatches.length > 0) {
    assessment.categories.push('substance');
    assessment.keywords.push(...substanceMatches);
    riskScore += substanceMatches.length * 5;
    assessment.resources.push(CRISIS_RESOURCES.samhsa);
  }

  // Check for immediate risk indicators
  const immediateMatches = CRISIS_KEYWORDS.immediateRisk.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  if (immediateMatches.length > 0 && assessment.categories.length > 0) {
    riskScore += immediateMatches.length * 15;
  }

  // Determine risk level based on score
  if (riskScore === 0) {
    assessment.level = RISK_LEVELS.NONE;
  } else if (riskScore < 10) {
    assessment.level = RISK_LEVELS.LOW;
  } else if (riskScore < 20) {
    assessment.level = RISK_LEVELS.MEDIUM;
  } else if (riskScore < 40) {
    assessment.level = RISK_LEVELS.HIGH;
  } else {
    assessment.level = RISK_LEVELS.CRITICAL;
    assessment.requiresImmediateIntervention = true;
  }

  // Log high-risk assessments
  if (assessment.level === RISK_LEVELS.HIGH || assessment.level === RISK_LEVELS.CRITICAL) {
    logger.alert('High-risk message detected', {
      level: assessment.level,
      categories: assessment.categories,
      riskScore,
      messageLength: message.length,
    });
  }

  return assessment;
}

/**
 * Generates crisis intervention response
 * @param {Object} assessment - Risk assessment result
 * @returns {string} - Crisis intervention message
 */
export function generateCrisisResponse(assessment) {
  const { level, categories, resources } = assessment;

  // Critical risk - immediate intervention
  if (level === RISK_LEVELS.CRITICAL) {
    let response = `I'm really concerned about you right now. Your safety is the most important thing.\n\n`;
    response += `Please reach out to someone who can help immediately:\n\n`;

    if (categories.includes('suicide')) {
      response += `=Þ Call 988 (Suicide & Crisis Lifeline)\n`;
      response += `=¬ Text "HELLO" to 741741 (Crisis Text Line)\n\n`;
    }

    response += `These are free, confidential, and available 24/7. Real people who care are waiting to help.\n\n`;
    response += `If you're in immediate danger, please call 911 or go to your nearest emergency room.\n\n`;
    response += `You don't have to go through this alone. Please reach out to one of these resources right now.`;

    return response;
  }

  // High risk - strong intervention
  if (level === RISK_LEVELS.HIGH) {
    let response = `I hear that you're going through something really difficult right now, and I'm worried about you.\n\n`;
    response += `Please know that you don't have to face this alone. There are people who want to help:\n\n`;

    resources.forEach(resource => {
      response += `" ${resource.name}: ${resource.number}`;
      if (resource.text) response += ` or ${resource.text}`;
      response += `\n`;
    });

    response += `\nThese services are free, confidential, and available 24/7. They've helped millions of people who felt just like you do now.\n\n`;
    response += `Is there a trusted adult, counselor, or friend you could talk to?`;

    return response;
  }

  // Medium risk - supportive intervention
  if (level === RISK_LEVELS.MEDIUM) {
    let response = `Thank you for sharing this with me. What you're feeling matters, and I want to make sure you have support.\n\n`;

    if (categories.includes('selfHarm')) {
      response += `Self-harm can be a sign that you're dealing with really intense emotions. `;
    }

    response += `Here are some resources that might help:\n\n`;

    resources.forEach(resource => {
      response += `" ${resource.name}: ${resource.number}`;
      if (resource.text) response += ` or ${resource.text}`;
      response += `\n`;
    });

    response += `\nHave you been able to talk to a counselor, therapist, or trusted adult about how you're feeling?`;

    return response;
  }

  // Low risk - gentle check-in
  if (level === RISK_LEVELS.LOW) {
    let response = `I'm here to listen and support you. `;
    response += `If things ever feel overwhelming, remember that professional support is available:\n\n`;
    response += `" 988 for immediate crisis support\n`;
    response += `" Text "HELLO" to 741741 for Crisis Text Line\n\n`;
    response += `What's on your mind?`;

    return response;
  }

  return null;
}

/**
 * Checks if message requires human escalation
 * @param {Object} assessment - Risk assessment result
 * @returns {boolean}
 */
export function requiresHumanEscalation(assessment) {
  return assessment.level === RISK_LEVELS.CRITICAL ||
         assessment.level === RISK_LEVELS.HIGH;
}

/**
 * Checks if conversation should be flagged for review
 * @param {Object} assessment - Risk assessment result
 * @returns {boolean}
 */
export function requiresReview(assessment) {
  return assessment.level !== RISK_LEVELS.NONE;
}

/**
 * Generates safety plan prompt
 * @returns {string}
 */
export function getSafetyPlanPrompt() {
  return `Let's work on a safety plan together. This can help when things get tough:\n\n` +
    `1. Warning Signs: What feelings or situations tell you things are getting hard?\n` +
    `2. Coping Strategies: What helps you feel better? (music, walking, talking, etc.)\n` +
    `3. People to Call: Who can you reach out to? (friend, family, counselor)\n` +
    `4. Professional Help: 988 (Suicide & Crisis Lifeline), Text HELLO to 741741\n` +
    `5. Safe Environment: Remove things that could be harmful\n\n` +
    `Would you like to work on any of these together?`;
}

/**
 * Validates that safety features are properly configured
 * @returns {boolean}
 */
export function validateSafetyConfiguration() {
  // Check that crisis resources are properly defined
  const requiredResources = ['suicide', 'crisisText', 'abuse'];
  const hasAllResources = requiredResources.every(key =>
    CRISIS_RESOURCES[key] && CRISIS_RESOURCES[key].number
  );

  if (!hasAllResources) {
    logger.error('Safety configuration validation failed: Missing required crisis resources');
    return false;
  }

  logger.info('Safety configuration validated successfully');
  return true;
}

export default {
  assessRisk,
  generateCrisisResponse,
  requiresHumanEscalation,
  requiresReview,
  getSafetyPlanPrompt,
  validateSafetyConfiguration,
  CRISIS_RESOURCES,
  RISK_LEVELS,
};
