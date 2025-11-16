// Simple Test Suite for Mental Health Chatbot
import safety from './safety.js';
import aiEngine from './aiEngine.js';
import commands from './commands.js';
import logger from './logger.js';

console.log('>ê Running Mental Health Chatbot Tests...\n');

let passedTests = 0;
let failedTests = 0;

function test(description, testFn) {
  try {
    testFn();
    console.log(` PASS: ${description}`);
    passedTests++;
  } catch (error) {
    console.log(`L FAIL: ${description}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Safety Module Tests
console.log('\n=Ë Testing Safety Module...');

test('Crisis detection - suicide keywords', () => {
  const assessment = safety.assessRisk('I want to kill myself');
  assert(assessment.level !== 'none', 'Should detect suicide risk');
  assert(assessment.categories.includes('suicide'), 'Should categorize as suicide');
});

test('Crisis detection - self-harm keywords', () => {
  const assessment = safety.assessRisk('I cut myself yesterday');
  assert(assessment.level !== 'none', 'Should detect self-harm risk');
  assert(assessment.categories.includes('selfHarm'), 'Should categorize as self-harm');
});

test('Crisis detection - normal message', () => {
  const assessment = safety.assessRisk('I had a good day today');
  assert(assessment.level === 'none', 'Should not detect risk in normal message');
  assert(assessment.categories.length === 0, 'Should have no risk categories');
});

test('Crisis response generation - critical level', () => {
  const assessment = { level: 'critical', categories: ['suicide'], resources: [] };
  const response = safety.generateCrisisResponse(assessment);
  assert(response.includes('988'), 'Should include 988 hotline');
  assert(response.includes('concerned'), 'Should express concern');
});

test('High risk requires escalation', () => {
  const assessment = { level: 'high', categories: ['suicide'] };
  assert(safety.requiresHumanEscalation(assessment), 'High risk should require escalation');
});

test('Medium risk requires review', () => {
  const assessment = { level: 'medium', categories: ['selfHarm'] };
  assert(safety.requiresReview(assessment), 'Medium risk should require review');
});

// Commands Module Tests
console.log('\n=Ë Testing Commands Module...');

test('Command detection - help', () => {
  assert(commands.isCommand('help'), 'Should detect "help" as command');
  assert(commands.isCommand('HELP'), 'Should detect "HELP" as command');
  assert(commands.isCommand('/help'), 'Should detect "/help" as command');
});

test('Command detection - resources', () => {
  assert(commands.isCommand('resources'), 'Should detect "resources" as command');
  assert(commands.isCommand('crisis'), 'Should detect "crisis" as command');
});

test('Command detection - non-command', () => {
  assert(!commands.isCommand('I need help with school'), 'Should not detect regular message as command');
});

test('Help message contains commands', async () => {
  const response = await commands.handleCommand('help');
  assert(response.includes('HELP'), 'Help message should list commands');
  assert(response.includes('RESOURCES'), 'Help message should include RESOURCES');
});

test('Crisis resources message', async () => {
  const response = await commands.handleCommand('crisis');
  assert(response.includes('988'), 'Crisis resources should include 988');
  assert(response.includes('741741'), 'Crisis resources should include Crisis Text Line');
});

test('Breathing exercise command', async () => {
  const response = await commands.handleCommand('breathe');
  assert(response.includes('breath'), 'Should include breathing instructions');
  assert(response.includes('4 seconds'), 'Should include timing');
});

test('Grounding exercise command', async () => {
  const response = await commands.handleCommand('grounding');
  assert(response.includes('5-4-3-2-1'), 'Should include 5-4-3-2-1 technique');
});

// AI Engine Tests
console.log('\n=Ë Testing AI Engine Module...');

test('Sentiment analysis - positive', () => {
  const sentiment = aiEngine.analyzeSentiment('I had a great day, feeling happy!');
  assert(sentiment === 'positive', 'Should detect positive sentiment');
});

test('Sentiment analysis - negative', () => {
  const sentiment = aiEngine.analyzeSentiment('I feel so sad and depressed');
  assert(sentiment === 'negative', 'Should detect negative sentiment');
});

test('Topic extraction - anxiety', () => {
  const topic = aiEngine.extractTopic('I feel so anxious about the test tomorrow');
  assert(topic === 'anxiety', 'Should extract anxiety topic');
});

test('Topic extraction - school', () => {
  const topic = aiEngine.extractTopic('I have so much homework from school');
  assert(topic === 'school', 'Should extract school topic');
});

test('Topic extraction - family', () => {
  const topic = aiEngine.extractTopic('My mom and dad are fighting again');
  assert(topic === 'family', 'Should extract family topic');
});

test('Greeting generation', () => {
  const greeting = aiEngine.generateGreeting();
  assert(greeting.length > 0, 'Should generate non-empty greeting');
  assert(greeting.includes('listen') || greeting.includes('support'), 'Should be supportive');
});

test('Check-in message generation', () => {
  const checkIn = aiEngine.generateCheckInMessage();
  assert(checkIn.length > 0, 'Should generate non-empty check-in');
  assert(checkIn.toLowerCase().includes('how'), 'Should ask how user is doing');
});

// Configuration Tests
console.log('\n=Ë Testing Configuration...');

test('Safety configuration validation', () => {
  const isValid = safety.validateSafetyConfiguration();
  assert(isValid, 'Safety configuration should be valid');
});

test('Crisis resources defined', () => {
  assert(safety.CRISIS_RESOURCES.suicide, 'Suicide hotline should be defined');
  assert(safety.CRISIS_RESOURCES.crisisText, 'Crisis text line should be defined');
  assert(safety.CRISIS_RESOURCES.abuse, 'Abuse hotline should be defined');
});

test('Crisis resources have numbers', () => {
  assert(safety.CRISIS_RESOURCES.suicide.number === '988', 'Suicide hotline should be 988');
  assert(safety.CRISIS_RESOURCES.crisisText.number === '741741', 'Crisis text should be 741741');
});

// Edge Cases
console.log('\n=Ë Testing Edge Cases...');

test('Empty message risk assessment', () => {
  const assessment = safety.assessRisk('');
  assert(assessment.level === 'none', 'Empty message should have no risk');
});

test('Very long message risk assessment', () => {
  const longMessage = 'I feel sad. '.repeat(100);
  const assessment = safety.assessRisk(longMessage);
  assert(assessment.level !== undefined, 'Should handle long messages');
});

test('Multiple crisis keywords', () => {
  const assessment = safety.assessRisk('I want to kill myself and I have been cutting');
  assert(assessment.categories.length > 1, 'Should detect multiple categories');
  assert(assessment.level === 'critical' || assessment.level === 'high', 'Should be high risk');
});

test('Case insensitivity', () => {
  const assessment1 = safety.assessRisk('HELP I WANT TO DIE');
  const assessment2 = safety.assessRisk('help i want to die');
  assert(assessment1.level === assessment2.level, 'Should be case insensitive');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('=Ê Test Summary');
console.log('='.repeat(50));
console.log(` Passed: ${passedTests}`);
console.log(`L Failed: ${failedTests}`);
console.log(`=È Total: ${passedTests + failedTests}`);
console.log(`<¯ Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n<‰ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n   ${failedTests} test(s) failed`);
  process.exit(1);
}
