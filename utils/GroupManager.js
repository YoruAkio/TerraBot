class GroupManager {
    constructor(terra) {
        this.terra = terra;
        this.logger = this.terra.logger.child({ name: 'GroupManager' });
        this.groups = new Map();
    }
    
    /**
     * Create a new group
     * @param {string} name - Group name
     * @param {string[]} participants - Array of participant JIDs
     * @returns {Promise<Object|null>} - Group info or null on failure
     */
    async createGroup(name, participants) {
        try {
            if (!name || !participants || participants.length === 0) {
                this.logger.error('Invalid group creation parameters');
                return null;
            }
            
            // Format participants for group creation
            const formattedParticipants = participants.map(jid => ({ id: jid }));
            
            const result = await this.terra.socket.groupCreate(name, formattedParticipants);
            this.logger.info(`Created group: ${name} with ${participants.length} participants`);
            
            // Add created group to cache
            if (result.id) {
                await this.fetchGroupMetadata(result.id);
            }
            
            return result;
        } catch (error) {
            this.logger.error(`Failed to create group ${name}:`, error);
            return null;
        }
    }
    
    /**
     * Get group metadata and cache it
     * @param {string} groupJid - Group JID
     * @returns {Promise<Object|null>} - Group metadata or null on failure
     */
    async fetchGroupMetadata(groupJid) {
        try {
            if (!groupJid.endsWith('@g.us')) {
                this.logger.error(`Invalid group JID: ${groupJid}`);
                return null;
            }
            
            const metadata = await this.terra.socket.groupMetadata(groupJid);
            
            if (metadata) {
                this.groups.set(groupJid, metadata);
                return metadata;
            }
            
            return null;
        } catch (error) {
            this.logger.error(`Failed to fetch group metadata for ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Get group metadata from cache or fetch it
     * @param {string} groupJid - Group JID
     * @param {boolean} forceRefresh - Whether to force refresh from server
     * @returns {Promise<Object|null>} - Group metadata or null on failure
     */
    async getGroupMetadata(groupJid, forceRefresh = false) {
        try {
            // Return from cache if available and refresh not forced
            if (!forceRefresh && this.groups.has(groupJid)) {
                return this.groups.get(groupJid);
            }
            
            return await this.fetchGroupMetadata(groupJid);
        } catch (error) {
            this.logger.error(`Error getting group metadata for ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Add participants to a group
     * @param {string} groupJid - Group JID
     * @param {string[]} participants - Array of participant JIDs to add
     * @returns {Promise<Object|null>} - Result or null on failure
     */
    async addParticipants(groupJid, participants) {
        try {
            if (!groupJid.endsWith('@g.us') || !participants || participants.length === 0) {
                this.logger.error('Invalid parameters for adding participants');
                return null;
            }
            
            const result = await this.terra.socket.groupParticipantsUpdate(
                groupJid, 
                participants,
                "add"
            );
            
            this.logger.info(`Added ${participants.length} participants to group ${groupJid}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return result;
        } catch (error) {
            this.logger.error(`Failed to add participants to group ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Remove participants from a group
     * @param {string} groupJid - Group JID
     * @param {string[]} participants - Array of participant JIDs to remove
     * @returns {Promise<Object|null>} - Result or null on failure
     */
    async removeParticipants(groupJid, participants) {
        try {
            if (!groupJid.endsWith('@g.us') || !participants || participants.length === 0) {
                this.logger.error('Invalid parameters for removing participants');
                return null;
            }
            
            const result = await this.terra.socket.groupParticipantsUpdate(
                groupJid, 
                participants,
                "remove"
            );
            
            this.logger.info(`Removed ${participants.length} participants from group ${groupJid}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return result;
        } catch (error) {
            this.logger.error(`Failed to remove participants from group ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Promote participants to admins in a group
     * @param {string} groupJid - Group JID
     * @param {string[]} participants - Array of participant JIDs to promote
     * @returns {Promise<Object|null>} - Result or null on failure
     */
    async promoteParticipants(groupJid, participants) {
        try {
            if (!groupJid.endsWith('@g.us') || !participants || participants.length === 0) {
                this.logger.error('Invalid parameters for promoting participants');
                return null;
            }
            
            const result = await this.terra.socket.groupParticipantsUpdate(
                groupJid, 
                participants,
                "promote"
            );
            
            this.logger.info(`Promoted ${participants.length} participants in group ${groupJid}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return result;
        } catch (error) {
            this.logger.error(`Failed to promote participants in group ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Demote admins to regular participants in a group
     * @param {string} groupJid - Group JID
     * @param {string[]} participants - Array of participant JIDs to demote
     * @returns {Promise<Object|null>} - Result or null on failure
     */
    async demoteParticipants(groupJid, participants) {
        try {
            if (!groupJid.endsWith('@g.us') || !participants || participants.length === 0) {
                this.logger.error('Invalid parameters for demoting participants');
                return null;
            }
            
            const result = await this.terra.socket.groupParticipantsUpdate(
                groupJid, 
                participants,
                "demote"
            );
            
            this.logger.info(`Demoted ${participants.length} participants in group ${groupJid}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return result;
        } catch (error) {
            this.logger.error(`Failed to demote participants in group ${groupJid}:`, error);
            return null;
        }
    }
    
    /**
     * Update group subject/name
     * @param {string} groupJid - Group JID
     * @param {string} subject - New group subject/name
     * @returns {Promise<boolean>} - Success status
     */
    async updateGroupSubject(groupJid, subject) {
        try {
            if (!groupJid.endsWith('@g.us') || !subject) {
                this.logger.error('Invalid parameters for updating group subject');
                return false;
            }
            
            await this.terra.socket.groupUpdateSubject(groupJid, subject);
            this.logger.info(`Updated subject for group ${groupJid} to "${subject}"`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to update group subject for ${groupJid}:`, error);
            return false;
        }
    }
    
    /**
     * Update group description
     * @param {string} groupJid - Group JID
     * @param {string} description - New group description
     * @returns {Promise<boolean>} - Success status
     */
    async updateGroupDescription(groupJid, description) {
        try {
            if (!groupJid.endsWith('@g.us') || description === undefined) {
                this.logger.error('Invalid parameters for updating group description');
                return false;
            }
            
            await this.terra.socket.groupUpdateDescription(groupJid, description);
            this.logger.info(`Updated description for group ${groupJid}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to update group description for ${groupJid}:`, error);
            return false;
        }
    }
    
    /**
     * Update group settings
     * @param {string} groupJid - Group JID
     * @param {string} setting - Setting to update (announce|restrict|locked)
     * @param {boolean} value - Setting value
     * @returns {Promise<boolean>} - Success status
     */
    async updateGroupSetting(groupJid, setting, value) {
        try {
            if (!groupJid.endsWith('@g.us') || !['announce', 'restrict', 'locked'].includes(setting)) {
                this.logger.error('Invalid parameters for updating group setting');
                return false;
            }
            
            await this.terra.socket.groupSettingUpdate(groupJid, setting, value);
            this.logger.info(`Updated setting ${setting} for group ${groupJid} to ${value}`);
            
            // Refresh group metadata in cache
            await this.fetchGroupMetadata(groupJid);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to update group setting for ${groupJid}:`, error);
            return false;
        }
    }
    
    /**
     * Leave a group
     * @param {string} groupJid - Group JID
     * @returns {Promise<boolean>} - Success status
     */
    async leaveGroup(groupJid) {
        try {
            if (!groupJid.endsWith('@g.us')) {
                this.logger.error('Invalid group JID for leaving group');
                return false;
            }
            
            await this.terra.socket.groupLeave(groupJid);
            this.logger.info(`Left group ${groupJid}`);
            
            // Remove from cache
            this.groups.delete(groupJid);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to leave group ${groupJid}:`, error);
            return false;
        }
    }
    
    /**
     * Get all groups the bot is in
     * @returns {Promise<Object[]>} - Array of group metadata
     */
    async getAllGroups() {
        try {
            // Get list of all chats
            const chats = await this.terra.socket.groupFetchAllParticipating();
            const groupIds = Object.keys(chats);
            
            this.logger.info(`Fetched ${groupIds.length} groups`);
            
            // Update cache
            for (const groupId of groupIds) {
                this.groups.set(groupId, chats[groupId]);
            }
            
            return groupIds.map(id => chats[id]);
        } catch (error) {
            this.logger.error('Failed to fetch all groups:', error);
            return [];
        }
    }
    
    /**
     * Check if the bot is admin in a group
     * @param {string} groupJid - Group JID
     * @returns {Promise<boolean>} - Whether the bot is admin
     */
    async isBotAdmin(groupJid) {
        try {
            // Get bot's JID
            const botJid = this.terra.socket.user.id.replace(/:.+@/, '@');
            
            // Get group metadata
            const metadata = await this.getGroupMetadata(groupJid);
            
            if (!metadata) return false;
            
            // Check if bot is in admin list
            return metadata.participants.some(
                p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
            );
        } catch (error) {
            this.logger.error(`Failed to check admin status for ${groupJid}:`, error);
            return false;
        }
    }
    
    /**
     * Check if a user is admin in a group
     * @param {string} groupJid - Group JID
     * @param {string} userJid - User JID
     * @returns {Promise<boolean>} - Whether the user is admin
     */
    async isUserAdmin(groupJid, userJid) {
        try {
            // Get group metadata
            const metadata = await this.getGroupMetadata(groupJid);
            
            if (!metadata) return false;
            
            // Check if user is in admin list
            return metadata.participants.some(
                p => p.id === userJid && (p.admin === 'admin' || p.admin === 'superadmin')
            );
        } catch (error) {
            this.logger.error(`Failed to check admin status for user ${userJid} in group ${groupJid}:`, error);
            return false;
        }
    }
}

module.exports = GroupManager;