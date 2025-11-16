// Session Manager - Handle user sessions and conversation state
import memory from './memory.js';
import logger from './logger.js';

/**
 * Session state management
 */
export class SessionManager {
  constructor() {
    this.sessions = new Map(); // In-memory fallback
  }

  /**
   * Get or create a session for a user
   */
  async getSession(phoneNumber) {
    try {
      // Try to get from Redis first
      let session = await memory.getSession(phoneNumber);

      // If not in Redis, check in-memory fallback
      if (!session || Object.keys(session).length === 0) {
        session = this.sessions.get(phoneNumber);
      }

      // Create new session if none exists
      if (!session) {
        session = this.createNewSession(phoneNumber);
        await this.saveSession(phoneNumber, session);
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();

      return session;
    } catch (error) {
      logger.error('Failed to get session', { error: error.message, phoneNumber });
      return this.createNewSession(phoneNumber);
    }
  }

  /**
   * Create a new session
   */
  createNewSession(phoneNumber) {
    return {
      phoneNumber,
      conversationContext: [],
      currentTopic: null,
      mood: null,
      riskLevel: 'none',
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      isFirstTime: true,
      preferences: {},
      flags: {
        needsCheckIn: false,
        inCrisis: false,
        hasSeenResources: false,
      },
    };
  }

  /**
   * Save session to storage
   */
  async saveSession(phoneNumber, session) {
    try {
      // Save to Redis with 1 hour expiry
      await memory.updateSession(phoneNumber, session, 3600);

      // Also keep in memory as fallback
      this.sessions.set(phoneNumber, session);

      return true;
    } catch (error) {
      logger.error('Failed to save session', { error: error.message, phoneNumber });
      // Still save to in-memory fallback
      this.sessions.set(phoneNumber, session);
      return false;
    }
  }

  /**
   * Update conversation context
   */
  async updateContext(phoneNumber, userMessage, assistantResponse, riskAssessment) {
    try {
      const session = await this.getSession(phoneNumber);

      // Add to conversation context (keep last 10 exchanges)
      session.conversationContext.push({
        user: userMessage,
        assistant: assistantResponse,
        timestamp: new Date().toISOString(),
        riskLevel: riskAssessment.level,
      });

      // Keep only last 10 exchanges to manage memory
      if (session.conversationContext.length > 10) {
        session.conversationContext = session.conversationContext.slice(-10);
      }

      // Update session metadata
      session.messageCount += 1;
      session.isFirstTime = false;

      // Update risk level if elevated
      if (this.compareRiskLevels(riskAssessment.level, session.riskLevel) > 0) {
        session.riskLevel = riskAssessment.level;
      }

      // Set flags based on risk
      if (riskAssessment.level === 'critical' || riskAssessment.level === 'high') {
        session.flags.inCrisis = true;
      }

      if (riskAssessment.resources && riskAssessment.resources.length > 0) {
        session.flags.hasSeenResources = true;
      }

      await this.saveSession(phoneNumber, session);

      return session;
    } catch (error) {
      logger.error('Failed to update context', { error: error.message, phoneNumber });
      return null;
    }
  }

  /**
   * Get conversation summary for AI context
   */
  async getContextForAI(phoneNumber) {
    try {
      const session = await this.getSession(phoneNumber);
      const history = await memory.getConversationHistory(phoneNumber, 5);
      const userProfile = await memory.getUserProfile(phoneNumber);

      return {
        isFirstTime: session.isFirstTime,
        messageCount: session.messageCount,
        currentTopic: session.currentTopic,
        mood: session.mood,
        riskLevel: session.riskLevel,
        recentMessages: session.conversationContext.slice(-5),
        flags: session.flags,
        userProfile: userProfile ? {
          totalMessages: userProfile.total_messages,
          firstInteraction: userProfile.first_interaction,
          riskLevel: userProfile.risk_level,
        } : null,
      };
    } catch (error) {
      logger.error('Failed to get context for AI', { error: error.message, phoneNumber });
      return { isFirstTime: true };
    }
  }

  /**
   * Compare risk levels
   */
  compareRiskLevels(level1, level2) {
    const levels = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    return levels[level1] - levels[level2];
  }

  /**
   * Mark user for check-in
   */
  async markForCheckIn(phoneNumber, reason) {
    try {
      const session = await this.getSession(phoneNumber);
      session.flags.needsCheckIn = true;
      session.checkInReason = reason;
      await this.saveSession(phoneNumber, session);

      logger.info('User marked for check-in', { phoneNumber: phoneNumber.slice(-4), reason });
    } catch (error) {
      logger.error('Failed to mark for check-in', { error: error.message, phoneNumber });
    }
  }

  /**
   * Clear crisis flag after resolution
   */
  async clearCrisisFlag(phoneNumber) {
    try {
      const session = await this.getSession(phoneNumber);
      session.flags.inCrisis = false;
      await this.saveSession(phoneNumber, session);

      logger.info('Crisis flag cleared', { phoneNumber: phoneNumber.slice(-4) });
    } catch (error) {
      logger.error('Failed to clear crisis flag', { error: error.message, phoneNumber });
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(phoneNumber, preferences) {
    try {
      const session = await this.getSession(phoneNumber);
      session.preferences = { ...session.preferences, ...preferences };
      await this.saveSession(phoneNumber, session);

      return true;
    } catch (error) {
      logger.error('Failed to update preferences', { error: error.message, phoneNumber });
      return false;
    }
  }

  /**
   * Set current conversation topic
   */
  async setTopic(phoneNumber, topic) {
    try {
      const session = await this.getSession(phoneNumber);
      session.currentTopic = topic;
      await this.saveSession(phoneNumber, session);
    } catch (error) {
      logger.error('Failed to set topic', { error: error.message, phoneNumber });
    }
  }

  /**
   * Update detected mood
   */
  async updateMood(phoneNumber, mood) {
    try {
      const session = await this.getSession(phoneNumber);
      session.mood = mood;
      await this.saveSession(phoneNumber, session);
    } catch (error) {
      logger.error('Failed to update mood', { error: error.message, phoneNumber });
    }
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions() {
    const now = Date.now();
    const hourInMs = 3600000;

    for (const [phoneNumber, session] of this.sessions.entries()) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > hourInMs) {
        this.sessions.delete(phoneNumber);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStatistics() {
    return {
      activeSessions: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => ({
        messageCount: s.messageCount,
        riskLevel: s.riskLevel,
        inCrisis: s.flags.inCrisis,
        lastActivity: s.lastActivity,
      })),
    };
  }
}

// Export singleton instance
export default new SessionManager();
