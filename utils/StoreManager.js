const { proto } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');

class StoreManager {
    constructor(terra) {
        this.terra = terra;
        this.logger = this.terra.logger.child({ name: 'StoreManager' });
        this.messageStore = new Map();
        this.sessionPath = terra.config.sessionPath;
    }
    
    /**
     * Initialize the message store
     */
    async initialize() {
        try {
            // Create message store directory if it doesn't exist
            const storePath = path.join(this.sessionPath, 'store');
            await fs.ensureDir(storePath);
            
            // Try to load existing message store
            const storeFile = path.join(storePath, 'messages.json');
            
            if (await fs.pathExists(storeFile)) {
                try {
                    const storedData = await fs.readJson(storeFile);
                    // Convert JSON object back to Map
                    for (const [key, value] of Object.entries(storedData)) {
                        this.messageStore.set(key, value);
                    }
                    this.logger.info('Message store loaded successfully');
                } catch (err) {
                    this.logger.warn('Failed to parse message store, creating new one', err);
                    this.messageStore = new Map();
                }
            } else {
                this.messageStore = new Map();
                this.logger.info('New message store created');
            }
            
            return true;
        } catch (error) {
            this.logger.error('Error initializing message store:' + error);
            // Don't throw error, just start with empty store
            this.messageStore = new Map();
            return false;
        }
    }
    
    /**
     * Save the message store to disk
     */
    async saveStore() {
        try {
            const storePath = path.join(this.sessionPath, 'store');
            await fs.ensureDir(storePath);
            
            // Convert Map to serializable object
            const serializableStore = {};
            this.messageStore.forEach((value, key) => {
                serializableStore[key] = value;
            });
            
            await fs.writeJson(
                path.join(storePath, 'messages.json'),
                serializableStore,
                { spaces: 2 }
            );
            
            return true;
        } catch (error) {
            this.logger.error('Error saving message store:' + error);
            return false;
        }
    }
    
    /**
     * Save a message to memory store
     * @param {Object} message - WhatsApp message object
     * @returns {Boolean} - Success status
     */
    async saveMessage(message) {
        try {
            const key = `${message.key.remoteJid}_${message.key.id}`;
            this.messageStore.set(key, message);
            
            // Limit message store size
            if (this.messageStore.size > 1000) {
                // Delete oldest message
                const firstKey = this.messageStore.keys().next().value;
                this.messageStore.delete(firstKey);
            }
            
            // Periodically save to disk (not on every message to reduce I/O)
            if (this.messageStore.size % 50 === 0) {
                await this.saveStore();
            }
            
            return true;
        } catch (error) {
            this.logger.error('Error saving message:' + error);
            return false;
        }
    }
    
    /**
     * Get message from store by key
     * @param {Object} key - Message key object
     * @returns {Object|null} - Message object or null if not found
     */
    getMessage(key) {
        try {
            const storeKey = `${key.remoteJid}_${key.id}`;
            return this.messageStore.get(storeKey) || null;
        } catch (error) {
            this.logger.error('Error getting message:' + error);
            return null;
        }
    }
    
    /**
     * Clear session data
     * @returns {Boolean} - Success status
     */
    async clearSession() {
        try {
            await fs.emptyDir(this.terra.config.sessionPath);
            this.messageStore.clear();
            this.logger.info('Session data cleared');
            return true;
        } catch (error) {
            this.logger.error('Error clearing session:' + error);
            return false;
        }
    }
}

module.exports = StoreManager;