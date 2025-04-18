const fs = require('fs-extra');
const path = require('path');

module.exports = {
  name: 'profile',
  description: 'Display your profile information and stats',
  aliases: ['p', 'me', 'stats', 'info'],
  usage: '{prefix}profile [@user]',
  cooldown: 5,
  category: 'fun',
  execute: async (terra, msg, args, context = {}) => {
    try {
      // Determine the target user (mentioned user or message sender)
      let targetUser;
      if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else {
        targetUser = msg.key.participant || msg.key.remoteJid;
      }

      // Clean JID for lookup
      const userId = targetUser.split('@')[0];
      
      // Get user data from database
      const userData = await getUserData(userId);
      
      if (!userData) {
        return terra.reply(msg, "User has no profile data yet. Send some messages first!");
      }
      
      // Get XP progress information
      const progress = userData.level > 1 ? 
        terra.levelManager.getProgress(userData.level, userData.xp) : 
        { percentage: Math.floor((userData.xp / 100) * 100), currentXp: userData.xp, neededXp: 100 };
      
      // Get user rank
      const rank = terra.levelManager.getUserRank(userId);
      
      // Create progress bar
      const progressBar = createProgressBar(progress.percentage, 10);
      
      // Format dates
      const lastActive = formatDate(new Date(userData.lastActive));
      const joinedAt = formatDate(new Date(userData.joinedAt));
      
      // Create profile message
      const profileMsg = `*🌟 User Profile 🌟*\n\n` +
        `👤 *User:* ${userData.pushName || userId}\n` +
        `📊 *Level:* ${userData.level}\n` +
        `✨ *XP:* ${userData.xp.toLocaleString()} XP\n` +
        `📈 *Progress:* ${progress.currentXp}/${progress.neededXp} XP (${progress.percentage}%)\n` +
        `${progressBar}\n\n` +
        
        `🏆 *Rank:* #${rank}\n` +
        `💬 *Messages:* ${userData.messages.toLocaleString()}\n` +
        `⏱️ *Last Active:* ${lastActive}\n` +
        `📅 *Joined:* ${joinedAt}\n\n` +
        
        `🌐 *Groups:* ${userData.groups?.length || 0} groups\n`;
        
      // Send profile message
      await terra.reply(msg, profileMsg);
    } catch (error) {
      terra.logger.error(`Error in profile command: ${error.message}`);
      return terra.reply(msg, 'Error retrieving profile data. Please try again later.');
    }
  }
};

/**
 * Get user data from database
 * @param {string} userId User ID
 * @returns {object|null} User data or null if not found
 */
async function getUserData(userId) {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'users.json');
    
    // Check if database exists
    if (!await fs.pathExists(dbPath)) {
      return null;
    }
    
    // Read database
    const data = await fs.readJson(dbPath);
    
    // Return user data if found, null otherwise
    return data[userId] || null;
  } catch (error) {
    terra.logger.error(`Error reading user data: ${error.message}`);
    return null;
  }
}

/**
 * Create a progress bar representation
 * @param {number} percentage Percentage (0-100)
 * @param {number} length Length of progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(percentage, length = 10) {
  const filled = Math.floor((percentage / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, length - filled));
}

/**
 * Format date to a readable string
 * @param {Date} date Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }
}