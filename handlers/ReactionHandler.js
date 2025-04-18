class ReactionHandler {
    constructor(terra) {
        this.terra = terra;
        this.logger = this.terra.logger.child({ name: 'ReactionHandler' });
        this.reactions = new Map();
    }
    
    /**
     * Handle incoming reactions
     * @param {Array} reactions - Array of reaction events
     */
    async handleReactions(reactions) {
        try {
            for (const { reaction } of reactions) {
                // Skip if the message or key is missing
                if (!reaction || !reaction.key) continue;
                
                const emoji = reaction.text || '';
                const isFromMe = reaction.key.fromMe;
                const senderId = reaction.key.participant || reaction.key.remoteJid;
                const messageId = reaction.key.id;
                const chatId = reaction.key.remoteJid;
                
                // Log reaction
                this.logger.debug(`Reaction received: ${emoji} from ${senderId} for message ${messageId} in ${chatId}`);
                
                // Store reaction in memory
                const reactionKey = `${messageId}_${senderId}`;
                this.reactions.set(reactionKey, {
                    emoji,
                    senderId,
                    messageId,
                    chatId,
                    timestamp: Date.now()
                });
                
                // Emit event for custom handling
                this.terra.eventHandler.emit('reaction', {
                    reaction,
                    emoji,
                    senderId,
                    messageId,
                    chatId,
                    isFromMe
                });
            }
        } catch (error) {
            this.logger.error('Error handling reactions:', error);
        }
    }
    
    /**
     * Get all reactions for a specific message
     * @param {string} messageId - Message ID to get reactions for
     * @returns {Array} - Array of reactions
     */
    getReactionsForMessage(messageId) {
        const result = [];
        
        for (const [key, reaction] of this.reactions.entries()) {
            if (reaction.messageId === messageId) {
                result.push(reaction);
            }
        }
        
        return result;
    }
}

module.exports = ReactionHandler;