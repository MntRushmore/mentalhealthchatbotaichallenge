// Check-ins Module - Proactive wellness checks
import cron from 'node-cron';
import memory from './memory.js';
import messageHandler from './messageHandler.js';
import logger from './logger.js';

let checkInJob = null;

/**
 * Initialize scheduled check-ins
 */
export function initializeCheckIns() {
  // Run check-ins daily at 6 PM
  checkInJob = cron.schedule('0 18 * * *', async () => {
    logger.info('Running scheduled check-ins');
    await runCheckIns();
  });

  logger.info('Check-in scheduler initialized (daily at 6 PM)');
}

/**
 * Run check-ins for users who need them
 */
export async function runCheckIns() {
  try {
    // Get users who haven't interacted in 24+ hours
    const users = await memory.getUsersForCheckIn(24);

    logger.info(`Found ${users.length} users for check-in`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await messageHandler.sendCheckIn(user.phone_number, user);
        successCount++;

        // Delay between check-ins to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error('Failed to send check-in', {
          phoneNumber: user.phone_number.slice(-4),
          error: error.message,
        });
        failCount++;
      }
    }

    logger.info('Check-ins completed', {
      total: users.length,
      success: successCount,
      failed: failCount,
    });

    return {
      total: users.length,
      success: successCount,
      failed: failCount,
    };
  } catch (error) {
    logger.logError(error, { context: 'runCheckIns' });
    return {
      total: 0,
      success: 0,
      failed: 0,
      error: error.message,
    };
  }
}

/**
 * Send urgent check-in to high-risk users
 */
export async function sendUrgentCheckIns() {
  try {
    // Get high-risk users who haven't interacted recently
    const users = await memory.getUsersForCheckIn(12);

    const highRiskUsers = users.filter(
      u => u.risk_level === 'high' || u.risk_level === 'critical'
    );

    logger.info(`Found ${highRiskUsers.length} high-risk users for urgent check-in`);

    for (const user of highRiskUsers) {
      await messageHandler.sendCheckIn(user.phone_number, user);

      // Delay between check-ins
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      success: true,
      count: highRiskUsers.length,
    };
  } catch (error) {
    logger.logError(error, { context: 'sendUrgentCheckIns' });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Schedule custom check-in for specific user
 */
export async function scheduleCustomCheckIn(phoneNumber, delayHours = 24) {
  try {
    setTimeout(async () => {
      const userProfile = await memory.getUserProfile(phoneNumber);
      await messageHandler.sendCheckIn(phoneNumber, userProfile);
    }, delayHours * 60 * 60 * 1000);

    logger.info('Custom check-in scheduled', {
      phoneNumber: phoneNumber.slice(-4),
      delayHours,
    });

    return {
      success: true,
      scheduledFor: new Date(Date.now() + delayHours * 60 * 60 * 1000),
    };
  } catch (error) {
    logger.logError(error, { context: 'scheduleCustomCheckIn', phoneNumber });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Stop scheduled check-ins
 */
export function stopCheckIns() {
  if (checkInJob) {
    checkInJob.stop();
    logger.info('Check-in scheduler stopped');
  }
}

/**
 * Get check-in statistics
 */
export async function getCheckInStats() {
  try {
    // This would query the check_ins table for statistics
    // Simplified version for now
    return {
      success: true,
      stats: {
        totalSent: 0, // Would query database
        responseRate: 0,
        averageResponseTime: 0,
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getCheckInStats' });
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  initializeCheckIns,
  runCheckIns,
  sendUrgentCheckIns,
  scheduleCustomCheckIn,
  stopCheckIns,
  getCheckInStats,
};
