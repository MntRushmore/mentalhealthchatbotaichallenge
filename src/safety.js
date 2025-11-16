import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Critical keywords - immediate crisis detection
const CRISIS_KEYWORDS = {
  selfHarm: [
    'kill myself', 'end my life', 'suicide', 'suicidal', 'want to die', 
    'better off dead', 'overdose', 'cut myself', 'hurt myself', 
    'end it all', 'no reason to live', 'take my life', 'going to die',
    'pills', 'jump off', 'hang myself', 'shoot myself'
  ],
  harmToOthers: [
    'kill them', 'hurt someone', 'going to hurt', 'violent thoughts', 
    'make them pay', 'going to attack', 'bring a gun', 'bring a weapon',
    'hurt people', 'shoot up', 'stab them'
  ],
  abuse: [
    'being hurt', 'hitting me', 'touches me', 'hurting me', 'unsafe at home',
    'scared of them', 'won\'t let me leave', 'locks me in', 'beats me',
    'molests me', 'sexual abuse', 'physical abuse'
  ],
  extremeDistress: [
    'can\'t breathe', 'losing control', 'heart racing', 
    'chest pain', 'think i\'m dying', 'having a heart attack',
    'severe pain', 'can\'t stop shaking'
  ]
};

export async function checkCrisis(message) {
  const messageLower = message.toLowerCase();
  
  // Layer 1: Keyword detection - IMMEDIATE
  for (const [category, keywords] of Object.entries(CRISIS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        return {
          isCrisis: true,
          reason: `keyword_match_${category}`,
          keyword
        };
      }
    }
  }
  
  // Layer 2: AI-powered context analysis for ambiguous cases
  const concerningPatterns = [
    'don\'t want to', 'can\'t take', 'give up', 'hopeless', 
    'pointless', 'nothing matters', 'everyone would be', 'no point',
    'better off', 'can\'t go on', 'too hard', 'too much'
  ];
  
  const hasConcerningPattern = concerningPatterns.some(pattern => 
    messageLower.includes(pattern)
  );
  
  if (hasConcerningPattern && message.length > 20) {
    try {
      const aiAnalysis = await analyzeWithAI(message);
      if (aiAnalysis.isCrisis) {
        return {
          isCrisis: true,
          reason: 'ai_analysis',
          confidence: aiAnalysis.confidence
        };
      }
    } catch (error) {
      logger.error('AI safety check failed', { error: error.message });
      // Fail safe: if concerning content and AI fails, treat as crisis
      if (hasConcerningPattern && 
          (messageLower.includes('die') || 
           messageLower.includes('hurt') || 
           messageLower.includes('end'))) {
        return {
          isCrisis: true,
          reason: 'safety_check_failure_failsafe'
        };
      }
    }
  }
  
  return { isCrisis: false };
}

async function analyzeWithAI(message) {
  const safetyPrompt = `You are a crisis detection system. Analyze this message and determine if it indicates:
1. Imminent self-harm or suicide risk
2. Plans to harm others
3. Active abuse situation
4. Medical emergency

Message: "${message}"

Respond with ONLY "CRISIS" or "SAFE" followed by confidence (HIGH/MEDIUM/LOW).
Format: CRISIS HIGH or SAFE HIGH`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: safetyPrompt
      }]
    });
    
    const result = response.content[0].text.trim();
    const isCrisis = result.startsWith('CRISIS');
    const confidence = result.includes('HIGH') ? 'high' : 
                      result.includes('MEDIUM') ? 'medium' : 'low';
    
    return { isCrisis, confidence };
    
  } catch (error) {
    throw error;
  }
}

// ========================================
// FILE: src/aiEngine.js
// ========================================
import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CALMTEXT_SYSTEM_PROMPT = `You are CalmText, a warm, supportive mental-health companion designed for teens. You communicate only through short, SMS-friendly messages. You are not a therapist and must never offer medical, diagnostic, or clinical advice. Your job is to help the user feel heard, understood, and calmer through empathy, reflective listening, grounding exercises, and gentle guidance.

1. Tone + Personality Rules
You must always:
• Be calm, caring, and non-judgmental.
• Keep replies concise (1–3 sentences max).
• Use natural human language, not formal or robotic.
• Validate feelings before giving suggestions.
• Avoid clichés or quotes.
• Never guilt, pressure, or dismiss the user.
• Never talk about yourself unless explaining how the bot works.

2. Non-Crisis Emotional Support Rules
Follow this sequence:
Step 1 — Emotion Recognition: Identify the user's main emotion.
Step 2 — Validation: "[Emotion] makes sense because [reason]."
Step 3 — Gentle Reflection or Question: "What part feels the hardest right now?" or "Do you want to talk through what happened?"
Step 4 — Optional Coping Tool (only if user is open): "Would you like a quick grounding exercise or want to keep talking?"

3. Allowed Coping Tools
Use only:
• Grounding: 5-4-3-2-1 senses, 10-second breathing, Name 3 things around you
• Emotional Labeling: Help them name feelings
• Cognitive Softening: "It makes sense you see it that way — here's another gentle angle…"
• Micro-Reflection: "What's one thing you wish someone understood about this?"
• Practical Comfort: Take a sip of water, stretch, breathe

4. Forbidden Content
DO NOT:
• Act like a therapist
• Give medical/legal advice
• Tell users what decision to make
• Promise confidentiality
• Say "I know exactly how you feel"
• Ask intense personal questions
• Encourage dependence
• Use paragraphs

5. Response Format
1–3 sentences. Warm. Human. No emojis unless user uses them first.`;

export async function generateAIResponse(userMessage, context = []) {
  try {
    // Build conversation history
    const messages = [];
    
    // Add context (last 5 messages)
    const recentContext = context.slice(-5).filter(msg => !msg.crisis);
    for (const msg of recentContext) {
      messages.push({ role: 'user', content: msg.user });
      messages.push({ role: 'assistant', content: msg.assistant });
    }
    
    // Add current message
    messages.push({ role: 'user', content: userMessage });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: CALMTEXT_SYSTEM_PROMPT,
      messages: messages
    });
    
    let aiResponse = response.content[0].text.trim();
    
    // Validate response
    aiResponse = validateResponse(aiResponse);
    
    return aiResponse;
    
  } catch (error) {
    logger.error('AI generation error', { 
      error: error.message,
      type: error.type || 'unknown'
    });
    
    // Fallback responses based on error type
    if (error.type === 'rate_limit_error') {
      return "I'm getting a lot of messages right now. If you need immediate help, please call 988.";
    }
    
    return "I'm here to listen. What's on your mind?";
  }
}

function validateResponse(response) {
  // Remove any forbidden content patterns
  const forbiddenPatterns = [
    /I am (not )?a therapist/gi,
    /you should see a (doctor|therapist|professional|counselor)/gi,
    /I diagnose/gi,
    /medical advice/gi,
    /call 911/gi,
    /go to (the )?emergency/gi
  ];
  
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(response)) {
      logger.warn('Forbidden pattern detected in response', { 
        response: response.substring(0, 50) 
      });
      return "I'm here to support you. What feels most important to talk about right now?";
    }
  }
  
  // Ensure response is concise (under 400 chars for SMS)
  if (response.length > 400) {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    response = sentences.slice(0, 2).join('. ').trim() + '.';
  }
  
  return response;
}
