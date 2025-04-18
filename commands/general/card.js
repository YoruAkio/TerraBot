const fs = require('fs-extra');
const path = require('path');
const CanvasManager = require('../../utils/CanvasManager');

module.exports = {
  name: 'card',
  description: 'Display your profile card with stats',
  aliases: ['profilecard', 'pc'],
  usage: '{prefix}card [@user]',
  cooldown: 10,
  category: 'fun',
  execute: async (terra, msg, args, context = {}) => {
    try {
      await terra.reply(msg, "⏳ Generating profile card...");
      
      // Initialize canvas manager
      const canvasManager = new CanvasManager();

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
      
      // Try to get profile picture
      let profilePic = null;
      try {
        profilePic = await canvasManager.getProfilePicture(terra.socket, targetUser);
      } catch (ppError) {
        terra.logger.error(`Error fetching profile picture: ${ppError.message}`);
        profilePic = null; // Fallback to default if error occurs
      }
      
      // Generate the profile card
      const cardBuffer = await canvasManager.createProfileCard(userData, {
        progress,
        rank,
        profilePic
      });
      
      // Send the card image
      await terra.messageUtils.sendImage(
        msg.key.remoteJid,
        cardBuffer,
        `*${userData.pushName || userId}'s Profile*`,
        { quoted: msg }
      );
      
    } catch (error) {
      terra.logger.error(`Error in card command: ${error.message}`);
      return terra.reply(msg, 'Error generating profile card. Please try again later.');
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