// Memory Module - Conversation history and session storage
import { createClient } from 'redis';
import pg from 'pg';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const { Pool } = pg;

// Redis client for session/temporary storage
let redisClient;

// PostgreSQL client for persistent storage
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Initialize Redis connection
 */
export async function initializeRedis() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error.message });
    return false;
  }
}

/**
 * Initialize PostgreSQL database tables
 */
export async function initializeDatabase() {
  try {
    // Create users table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        phone_number VARCHAR(20) PRIMARY KEY,
        first_interaction TIMESTAMP DEFAULT NOW(),
        last_interaction TIMESTAMP DEFAULT NOW(),
        total_messages INTEGER DEFAULT 0,
        risk_level VARCHAR(20) DEFAULT 'none',
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create conversations table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) REFERENCES users(phone_number),
        message TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL, -- 'incoming' or 'outgoing'
        risk_level VARCHAR(20) DEFAULT 'none',
        risk_categories TEXT[],
        timestamp TIMESTAMP DEFAULT NOW(),
        session_id VARCHAR(100),
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    // Create crisis_events table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS crisis_events (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) REFERENCES users(phone_number),
        risk_level VARCHAR(20) NOT NULL,
        risk_categories TEXT[] NOT NULL,
        message_preview TEXT,
        escalated BOOLEAN DEFAULT false,
        resolved BOOLEAN DEFAULT false,
        timestamp TIMESTAMP DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    // Create check_ins table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) REFERENCES users(phone_number),
        sent_at TIMESTAMP DEFAULT NOW(),
        responded BOOLEAN DEFAULT false,
        response_text TEXT,
        response_time TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    // Create indexes for performance
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_crisis_events_phone ON crisis_events(phone_number);
      CREATE INDEX IF NOT EXISTS idx_crisis_events_timestamp ON crisis_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_risk_level ON users(risk_level);
    `);

    logger.info('Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize database', { error: error.message });
    return false;
  }
}

/**
 * Store conversation message
 */
export async function storeMessage(phoneNumber, message, direction, riskLevel = 'none', riskCategories = []) {
  try {
    // Store in PostgreSQL for permanent history
    await pgPool.query(
      `INSERT INTO conversations (phone_number, message, direction, risk_level, risk_categories)
       VALUES ($1, $2, $3, $4, $5)`,
      [phoneNumber, message, direction, riskLevel, riskCategories]
    );

    // Update user's last interaction
    await pgPool.query(
      `INSERT INTO users (phone_number, last_interaction, total_messages)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (phone_number)
       DO UPDATE SET last_interaction = NOW(), total_messages = users.total_messages + 1`,
      [phoneNumber]
    );

    // Update user's risk level if elevated
    if (riskLevel !== 'none') {
      await pgPool.query(
        `UPDATE users SET risk_level = $1 WHERE phone_number = $2 AND
         (risk_level = 'none' OR $1 > risk_level)`,
        [riskLevel, phoneNumber]
      );
    }

    return true;
  } catch (error) {
    logger.error('Failed to store message', { error: error.message, phoneNumber });
    return false;
  }
}

/**
 * Get conversation history for a user
 */
export async function getConversationHistory(phoneNumber, limit = 10) {
  try {
    const result = await pgPool.query(
      `SELECT message, direction, risk_level, timestamp
       FROM conversations
       WHERE phone_number = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [phoneNumber, limit]
    );

    return result.rows.reverse(); // Return in chronological order
  } catch (error) {
    logger.error('Failed to get conversation history', { error: error.message, phoneNumber });
    return [];
  }
}

/**
 * Store crisis event
 */
export async function storeCrisisEvent(phoneNumber, assessment, messagePreview) {
  try {
    const result = await pgPool.query(
      `INSERT INTO crisis_events (phone_number, risk_level, risk_categories, message_preview)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [phoneNumber, assessment.level, assessment.categories, messagePreview]
    );

    logger.alert('Crisis event stored', {
      eventId: result.rows[0].id,
      phoneNumber: phoneNumber.slice(-4),
      level: assessment.level,
    });

    return result.rows[0].id;
  } catch (error) {
    logger.error('Failed to store crisis event', { error: error.message, phoneNumber });
    return null;
  }
}

/**
 * Get user's session data from Redis
 */
export async function getSession(phoneNumber) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      logger.warn('Redis client not available, using database fallback');
      return {};
    }

    const sessionKey = `session:${phoneNumber}`;
    const sessionData = await redisClient.get(sessionKey);

    if (sessionData) {
      return JSON.parse(sessionData);
    }

    return {};
  } catch (error) {
    logger.error('Failed to get session', { error: error.message, phoneNumber });
    return {};
  }
}

/**
 * Update user's session data in Redis
 */
export async function updateSession(phoneNumber, sessionData, expirySeconds = 3600) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      logger.warn('Redis client not available');
      return false;
    }

    const sessionKey = `session:${phoneNumber}`;
    await redisClient.setEx(sessionKey, expirySeconds, JSON.stringify(sessionData));

    return true;
  } catch (error) {
    logger.error('Failed to update session', { error: error.message, phoneNumber });
    return false;
  }
}

/**
 * Store conversation context in Redis for AI
 */
export async function storeContext(phoneNumber, context) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }

    const contextKey = `context:${phoneNumber}`;
    await redisClient.setEx(contextKey, 7200, JSON.stringify(context)); // 2 hours

    return true;
  } catch (error) {
    logger.error('Failed to store context', { error: error.message, phoneNumber });
    return false;
  }
}

/**
 * Get conversation context from Redis
 */
export async function getContext(phoneNumber) {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return null;
    }

    const contextKey = `context:${phoneNumber}`;
    const contextData = await redisClient.get(contextKey);

    if (contextData) {
      return JSON.parse(contextData);
    }

    return null;
  } catch (error) {
    logger.error('Failed to get context', { error: error.message, phoneNumber });
    return null;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(phoneNumber) {
  try {
    const result = await pgPool.query(
      `SELECT * FROM users WHERE phone_number = $1`,
      [phoneNumber]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return null;
  } catch (error) {
    logger.error('Failed to get user profile', { error: error.message, phoneNumber });
    return null;
  }
}

/**
 * Record check-in sent
 */
export async function recordCheckIn(phoneNumber) {
  try {
    await pgPool.query(
      `INSERT INTO check_ins (phone_number) VALUES ($1)`,
      [phoneNumber]
    );

    return true;
  } catch (error) {
    logger.error('Failed to record check-in', { error: error.message, phoneNumber });
    return false;
  }
}

/**
 * Record check-in response
 */
export async function recordCheckInResponse(phoneNumber, responseText) {
  try {
    await pgPool.query(
      `UPDATE check_ins
       SET responded = true, response_text = $1, response_time = NOW()
       WHERE phone_number = $2
       AND sent_at = (SELECT MAX(sent_at) FROM check_ins WHERE phone_number = $2)`,
      [responseText, phoneNumber]
    );

    return true;
  } catch (error) {
    logger.error('Failed to record check-in response', { error: error.message, phoneNumber });
    return false;
  }
}

/**
 * Get users who need check-ins
 */
export async function getUsersForCheckIn(hoursSinceLastInteraction = 24) {
  try {
    const result = await pgPool.query(
      `SELECT phone_number, last_interaction, risk_level
       FROM users
       WHERE is_active = true
       AND last_interaction < NOW() - INTERVAL '${hoursSinceLastInteraction} hours'
       AND phone_number NOT IN (
         SELECT phone_number FROM check_ins
         WHERE sent_at > NOW() - INTERVAL '12 hours'
         AND responded = false
       )
       ORDER BY risk_level DESC, last_interaction ASC
       LIMIT 50`,
      []
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to get users for check-in', { error: error.message });
    return [];
  }
}

/**
 * Cleanup and close connections
 */
export async function cleanup() {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    await pgPool.end();
    logger.info('PostgreSQL connection closed');
  } catch (error) {
    logger.error('Error during cleanup', { error: error.message });
  }
}

// Initialize connections on module load
export async function initialize() {
  await initializeRedis();
  await initializeDatabase();
}

export default {
  initialize,
  initializeRedis,
  initializeDatabase,
  storeMessage,
  getConversationHistory,
  storeCrisisEvent,
  getSession,
  updateSession,
  storeContext,
  getContext,
  getUserProfile,
  recordCheckIn,
  recordCheckInResponse,
  getUsersForCheckIn,
  cleanup,
};
