class ContactManager {
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: "ContactManager" });
    this.contacts = new Map();
    this.failedFetchAttempts = new Map();
    this.maxRetries = 3; // Maximum number of retries for failed contacts
    this.retryDelay = 60000; // 1 minute delay before retrying a failed contact
    this.initComplete = false;
  }

  /**
   * Initialize the contact manager
   */
  async initialize() {
    try {
      this.logger.debug('Initializing ContactManager');
      
      // Preload contacts from device memory if possible
      if (this.terra.socket?.store?.contacts) {
        for (const [jid, contact] of Object.entries(this.terra.socket.store.contacts)) {
          if (contact && (contact.name || contact.notify || contact.verifiedName)) {
            this.contacts.set(jid, contact);
          }
        }
        this.logger.debug(`Preloaded ${this.contacts.size} contacts from store`);
      }
      
      this.initComplete = true;
      return true;
    } catch (error) {
      this.logger.error('Error initializing ContactManager:' + error);
      this.initComplete = true; // Set to true anyway so we don't keep trying to initialize
      return false;
    }
  }

  /**
   * Get contact details by JID with improved error handling
   * @param {string} jid - Contact JID
   * @returns {Promise<Object|null>} - Contact details or null
   */
  async getContact(jid) {
    try {
      if (!jid) return null;
      
      // Check if we need to initialize
      if (!this.initComplete) {
        await this.initialize();
      }
      
      // Try to get from cache first
      if (this.contacts.has(jid)) {
        return this.contacts.get(jid);
      }
      
      // Check if this contact recently failed and we shouldn't retry yet
      const failedAttempt = this.failedFetchAttempts.get(jid);
      if (failedAttempt) {
        const {count, lastTry} = failedAttempt;
        const now = Date.now();
        
        // If we've exceeded max retries and not enough time has passed
        if (count >= this.maxRetries && (now - lastTry) < this.retryDelay) {
          this.logger.debug(`Skipping fetch for ${jid} - too many recent failures`);
          return null;
        }
      }
      
      // Ensure we have a socket connection
      if (!this.terra.socket || !this.terra.isConnected) {
        this.logger.debug(`Cannot fetch contact ${jid}: Socket not connected`);
        return null;
      }

      // Fetch from WhatsApp with timeout
      const contact = await Promise.race([
        this.terra.socket.contactQuery(jid),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)) // 5 second timeout
      ]);

      if (contact) {
        // Successfully retrieved contact, store in cache
        this.contacts.set(jid, contact);
        // Clear failed attempts
        this.failedFetchAttempts.delete(jid);
        return contact;
      }

      // Track failed attempt
      this._trackFailedAttempt(jid);
      
      return null;
    } catch (error) {
      // Track failed attempt with specific error
      this._trackFailedAttempt(jid);
      
      // Log with proper error details
      this.logger.error(`Error fetching contact ${jid}: ${error}`.message || 'Unknown error');
      return null;
    }
  }
  
  /**
   * Track a failed contact fetch attempt
   * @private
   * @param {string} jid - Contact JID that failed to fetch
   */
  _trackFailedAttempt(jid) {
    const failedAttempt = this.failedFetchAttempts.get(jid) || { count: 0, lastTry: 0 };
    failedAttempt.count += 1;
    failedAttempt.lastTry = Date.now();
    this.failedFetchAttempts.set(jid, failedAttempt);
  }

  /**
   * Get profile picture of a contact
   * @param {string} jid - Contact JID
   * @returns {Promise<string|null>} - Profile picture URL or null
   */
  async getProfilePicture(jid) {
    try {
      if (!this.terra.socket || !this.terra.isConnected) {
        return null;
      }
      
      const result = await Promise.race([
        this.terra.socket.profilePictureUrl(jid, "image"),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)) // 5 second timeout
      ]);
      
      return result;
    } catch (error) {
      this.logger.debug(`No profile picture available for ${jid}: ${error.message || 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Check if a number exists on WhatsApp
   * @param {string} number - Phone number with country code
   * @returns {Promise<boolean>} - Whether the number exists
   */
  async isRegistered(number) {
    try {
      if (!this.terra.socket || !this.terra.isConnected) {
        return false;
      }
      
      // Format number for WhatsApp
      const formattedNumber = number.replace(/[^0-9]/g, "");
      
      const result = await Promise.race([
        this.terra.socket.onWhatsApp(formattedNumber),
        new Promise(resolve => setTimeout(() => resolve([]), 5000)) // 5 second timeout
      ]);
      
      return result?.[0]?.exists || false;
    } catch (error) {
      this.logger.error(
        `Error checking if number is registered: ${number}`,
        error.message || 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Get name of contact from store or jid with improved error handling
   * @param {string} jid - Contact JID
   * @returns {Promise<string>} - Name or phone number
   */
  async getName(jid) {
    try {
      // Special cases
      if (!jid) return "Unknown";
      if (jid === "status@broadcast") return "Status Updates";
      
      // First check our local cache for a quick return
      const cachedContact = this.contacts.get(jid);
      if (cachedContact) {
        if (cachedContact.name) return cachedContact.name;
        if (cachedContact.notify) return cachedContact.notify;
        if (cachedContact.verifiedName) return cachedContact.verifiedName;
      }
      
      // If not in cache, try to get contact info
      const contact = await this.getContact(jid);
      
      // Return name or fallback to phone number
      if (contact && contact.name) {
        return contact.name;
      } else if (contact && contact.notify) {
        return contact.notify;
      } else if (contact && contact.verifiedName) {
        return contact.verifiedName;
      }
      
      // Extract the phone number part as last resort
      return jid.split("@")[0];
    } catch (error) {
      // Just log the error and return a fallback value
      this.logger.debug(
        `Error getting contact name for ${jid}: ${error.message || 'Unknown error'}`
      );
      return jid.split("@")[0];
    }
  }

  /**
   * Block a user
   * @param {string} jid - User JID
   * @returns {Promise<boolean>} - Success status
   */
  async blockUser(jid) {
    try {
      if (!this.terra.socket || !this.terra.isConnected) {
        return false;
      }
      
      await this.terra.socket.updateBlockStatus(jid, "block");
      return true;
    } catch (error) {
      this.logger.error(`Error blocking user ${jid}: ${error.message || 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Unblock a user
   * @param {string} jid - User JID
   * @returns {Promise<boolean>} - Success status
   */
  async unblockUser(jid) {
    try {
      if (!this.terra.socket || !this.terra.isConnected) {
        return false;
      }
      
      await this.terra.socket.updateBlockStatus(jid, "unblock");
      return true;
    } catch (error) {
      this.logger.error(`Error unblocking user ${jid}: ${error.message || 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Clear contact cache
   */
  clearCache() {
    this.contacts.clear();
    this.failedFetchAttempts.clear();
    this.logger.debug('Contact cache cleared');
  }
}

module.exports = ContactManager;