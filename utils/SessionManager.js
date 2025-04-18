const fs = require('fs-extra');
const path = require('path');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

class SessionManager {
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: 'SessionManager' });
    this.sessionPath = terra.config.sessionPath;
    this.authState = null;
  }

  /**
   * Initialize the session
   * @returns {Promise<Object>} Auth state
   */
  async initialize() {
    try {
      // Ensure session directory exists
      await fs.ensureDir(this.sessionPath);
      
      // Load auth state
      this.logger.info(`Loading session from ${this.sessionPath}`);
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      
      // Check if session exists
      const sessionExists = await this._checkSessionExists();
      
      this.authState = { state, saveCreds };
      
      if (sessionExists) {
        this.logger.info('Session found, will attempt to restore');
      } else {
        this.logger.info('No session found, new QR code will be generated');
      }
      
      return this.authState;
    } catch (error) {
      this.logger.error('Error initializing session:' + error);
      throw error;
    }
  }

  /**
   * Check if a session exists
   * @private
   * @returns {Promise<boolean>} Whether a session exists
   */
  async _checkSessionExists() {
    try {
      // Check for creds.json file
      const credsPath = path.join(this.sessionPath, 'creds.json');
      return await fs.pathExists(credsPath);
    } catch (error) {
      this.logger.error('Error checking session existence:' + error);
      return false;
    }
  }

  /**
   * Save credentials
   * @param {Object} creds Credentials to save
   */
  async saveCreds(creds) {
    try {
      if (this.authState?.saveCreds) {
        await this.authState.saveCreds(creds);
        this.logger.debug('Credentials saved');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error saving credentials:' + error);
      return false;
    }
  }

  /**
   * Clear the session
   */
  async clearSession() {
    try {
      await fs.emptyDir(this.sessionPath);
      this.logger.info('Session cleared');
      return true;
    } catch (error) {
      this.logger.error('Error clearing session:' + error);
      return false;
    }
  }

  /**
   * Backup the session
   * @param {string} backupPath Path to backup to
   */
  async backupSession(backupPath = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = backupPath || path.join(this.sessionPath, '../backups');
      
      // Create backup directory if it doesn't exist
      await fs.ensureDir(backupDir);
      
      // Create backup
      const backupPath = path.join(backupDir, `session-backup-${timestamp}`);
      await fs.copy(this.sessionPath, backupPath);
      
      this.logger.info(`Session backed up to ${backupPath}`);
      return backupPath;
    } catch (error) {
      this.logger.error('Error backing up session:' + error);
      return null;
    }
  }

  /**
   * Restore a session from a backup
   * @param {string} backupPath Path to restore from
   */
  async restoreSession(backupPath) {
    try {
      if (!await fs.pathExists(backupPath)) {
        this.logger.error(`Backup doesn't exist: ${backupPath}`);
        return false;
      }
      
      // Backup current session first
      await this.backupSession();
      
      // Clear current session
      await this.clearSession();
      
      // Restore from backup
      await fs.copy(backupPath, this.sessionPath);
      
      this.logger.info(`Session restored from ${backupPath}`);
      return true;
    } catch (error) {
      this.logger.error('Error restoring session:' + error);
      return false;
    }
  }
}

module.exports = SessionManager;