const path = require('path');
const Database = require('./DatabaseManager');

/**
 * Manages user levels, XP, and progression
 */
class LevelManager {
  /**
   * Create a new LevelManager instance
   * @param {Object} terra The main Terra bot instance
   */
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: 'LevelManager' });
    
    // Initialize database
    this.db = new Database({
      name: 'UserLevels',
      filePath: path.join(process.cwd(), 'data', 'users.json'),
      logger: this.logger,
      autoSaveInterval: 20000 // 20 seconds
    });
    
    // XP cooldowns (in-memory only, not persisted)
    this.xpCooldowns = new Map();
    
    // XP settings
    this.messageXpMin = 10;      // Minimum XP per message
    this.messageXpMax = 25;      // Maximum XP per message
    this.xpCooldown = 5000;      // 5 seconds cooldown between XP gains
    this.maxLevel = 248;         // Maximum level cap
    this.minMessageLength = 3;   // Minimum message length to gain XP
  }

  /**
   * Initialize the level manager and load data
   */
  async initialize() {
    try {
      // Set up event handlers
      this.db.on('saved', () => {
        this.logger.debug('User data autosaved');
      });
      
      // Initialize database
      await this.db.initialize();
      return true;
    } catch (error) {
      this.logger.error('Error initializing LevelManager:', error);
      return false;
    }
  }

  /**
   * Force saving user data to file
   */
  async saveData() {
    return await this.db.save();
  }

  /**
   * Get or create user data
   * @param {string} userId User JID
   * @param {string} pushName User's display name (optional)
   * @returns {object} User data
   */
  getUserData(userId, pushName = null) {
    // Clean up JID
    const cleanUserId = userId.split('@')[0];
    
    // Get existing user data or create default
    let userData = this.db.get(cleanUserId);
    
    if (!userData) {
      // Create new user data
      userData = {
        jid: userId,
        pushName: pushName || cleanUserId,
        xp: 0,
        level: 1,
        messages: 0,
        lastActive: Date.now(),
        joinedAt: Date.now(),
        groups: []  // List of groups the user has been active in
      };
      
      // Store in database
      this.db.set(cleanUserId, userData);
    } else if (pushName && userData.pushName !== pushName) {
      // Update pushName if it has changed
      userData.pushName = pushName;
      this.db.set(cleanUserId, userData);
    }
    
    return userData;
  }

  /**
   * Process a message for XP gain
   * @param {object} msg Message object
   * @param {string} content Message content
   * @returns {object|null} Result with level up info if applicable
   */
  async processMessage(msg, content) {
    // Skip if leveling is disabled
    if (!this.terra.config.leveling?.enabled) {
      return null;
    }
    
    // Skip if message is too short
    if (!content || content.length < this.minMessageLength) {
      return null;
    }
    
    // Skip if the message is a command
    if (content.startsWith(this.terra.config.prefix)) {
      return null;
    }
    
    const userId = msg.key.participant || msg.key.remoteJid;
    const groupId = msg.key.remoteJid.endsWith('@g.us') ? msg.key.remoteJid : null;
    
    // Skip if not from a group
    if (!groupId) return null;
    
    // Check for private mode restrictions
    if (this.terra.config.privateMode) {
      // Get the participant JID
      const participantJid = msg.key.participant || msg.key.remoteJid;
      
      // Check if user is owner
      const isOwner = this.terra.config.owners.includes(participantJid.split('@')[0]);
      
      // Check if user is admin
      let isAdmin = false;
      try {
        const groupMetadata = await this.terra.groupManager.getGroupMetadata(groupId);
        const participant = groupMetadata.participants.find(p => p.id === participantJid);
        isAdmin = participant && ['admin', 'superadmin'].includes(participant.admin);
      } catch (error) {
        this.logger.error(`Error checking admin status: ${error.message}`);
      }
      
      // Only process XP for owners and admins in private mode
      if (!isOwner && !isAdmin) {
        return null;
      }
    }
    
    // Get the user's pushName if available
    const pushName = msg.pushName || null;
    
    return this.addXP(userId, groupId, 0, false, pushName);
  }

  /**
   * Add XP to a user
   * @param {string} userId User JID
   * @param {string} groupId Group JID (for tracking purposes)
   * @param {number} amount XP amount (if 0, random amount will be given)
   * @param {boolean} bypassCooldown Whether to bypass the cooldown check
   * @param {string} pushName User's display name (optional)
   * @returns {object|null} Level up information or null if on cooldown
   */
  async addXP(userId, groupId, amount = 0, bypassCooldown = false, pushName = null) {
    // Clean up JID
    const cleanUserId = userId.split('@')[0];
    
    // Check cooldown (unless bypassed)
    if (!bypassCooldown && amount === 0) {
      const now = Date.now();
      const cooldownTime = this.xpCooldowns.get(cleanUserId) || 0;
      
      // If on cooldown, return null
      if (now < cooldownTime) {
        return null;
      }
      
      // Set new cooldown
      this.xpCooldowns.set(cleanUserId, now + this.xpCooldown);
      
      // Random XP for messages
      amount = Math.floor(Math.random() * (this.messageXpMax - this.messageXpMin + 1)) + this.messageXpMin;
    }
    
    // Get user data with pushName if provided
    const userData = this.getUserData(userId, pushName);
    
    // Track old level
    const oldLevel = userData.level;
    
    // Add XP
    userData.xp += amount;
    userData.messages += 1;
    userData.lastActive = Date.now();
    
    // Track group participation
    if (groupId && !userData.groups.includes(groupId)) {
      userData.groups.push(groupId);
    }
    
    // Calculate level: Level = 1 + sqrt(XP/100)
    const newLevel = Math.min(
      Math.floor(1 + Math.sqrt(userData.xp / 100)),
      this.maxLevel
    );
    
    // Check for level up
    let leveledUp = false;
    if (newLevel > oldLevel) {
      userData.level = newLevel;
      leveledUp = true;
    }
    
    // Update in database (auto-save will happen via timer)
    this.db.set(cleanUserId, userData);
    
    // Force save on level up
    if (leveledUp) {
      await this.saveData();
    }
    
    return {
      userId: cleanUserId,
      pushName: userData.pushName,
      leveledUp,
      oldLevel,
      newLevel,
      xpGained: amount,
      currentXp: userData.xp,
      totalMessages: userData.messages
    };
  }

  /**
   * Get top users by XP
   * @param {number} limit Number of users to return
   * @returns {Array} Array of top users with their data
   */
  getTopUsers(limit = 10) {
    // Get all users, convert to array and sort by XP
    const users = this.db.entries()
      .map(([userId, data]) => ({
        userId,
        ...data
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
    
    return users;
  }

  /**
   * Get user's rank
   * @param {string} userId User JID
   * @returns {number} User's rank (position)
   */
  getUserRank(userId) {
    const cleanUserId = userId.split('@')[0];
    
    // Get all users sorted by XP
    const sortedUsers = this.db.entries()
      .sort(([, a], [, b]) => b.xp - a.xp);
    
    // Find user's position
    const position = sortedUsers.findIndex(([id]) => id === cleanUserId);
    
    return position !== -1 ? position + 1 : 0;
  }

  /**
   * Calculate XP needed for next level
   * @param {number} level Current level
   * @returns {number} XP needed for next level
   */
  getXpNeeded(level) {
    return Math.floor(100 * Math.pow(level, 2));
  }

  /**
   * Calculate XP progress
   * @param {number} level Current level
   * @param {number} xp Current XP
   * @returns {object} Progress information
   */
  getProgress(level, xp) {
    const currentLevelXp = this.getXpNeeded(level - 1);
    const nextLevelXp = this.getXpNeeded(level);
    const neededXp = nextLevelXp - currentLevelXp;
    const currentXp = xp - currentLevelXp;
    
    const percentage = Math.min(100, Math.max(0, Math.floor((currentXp / neededXp) * 100)));
    
    return {
      currentXp,
      neededXp,
      percentage,
      isMaxLevel: level >= this.maxLevel
    };
  }

  /**
   * Create a progress bar string
   * @param {number} percentage Percentage (0-100)
   * @param {number} length Length of progress bar
   * @returns {string} Progress bar string
   */
  createProgressBar(percentage, length = 10) {
    const filledLength = Math.floor((percentage / 100) * length);
    return '█'.repeat(filledLength) + '░'.repeat(Math.max(0, length - filledLength));
  }

  /**
   * Clean up resources when shutting down
   */
  async shutdown() {
    // Stop auto-save timer
    if (this.db) {
      this.db.stopAutoSave();
      
      // Final save
      await this.db.save();
    }
  }
}

module.exports = LevelManager;