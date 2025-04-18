module.exports = {
  name: 'message',
  description: 'Handles incoming messages and command execution',
  execute: async (terra, msg) => {
    // Skip messages from self
    if (msg.key.fromMe) return;
    
    // Extract the text content if available
    let content = '';
    
    if (msg.message?.conversation) {
      content = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      content = msg.message.extendedTextMessage.text;
    } else if (msg.message?.imageMessage?.caption) {
      content = msg.message.imageMessage.caption;
    } else if (msg.message?.videoMessage?.caption) {
      content = msg.message.videoMessage.caption;
    }
    
    if (content) {
      // Determine if this is a group message
      const sender = msg.key.remoteJid;
      const isGroup = sender.endsWith('@g.us');
      const participantJid = msg.key.participant || sender;
      
      // Get sender name safely with error handling
      let senderName;
      try {
        senderName = await terra.getUserName(msg);
      } catch (error) {
        terra.logger.debug(`Couldn't get sender name: ${error.message}`);
        senderName = participantJid.split('@')[0];
      }
      
      // Log message
      terra.logger.info(`Message from ${senderName} ${isGroup ? '(group)' : '(private)'}: ${content}`);
      
      // Check permission if private mode is enabled
      if (terra.config.privateMode) {
        let hasPermission = false;
        
        // Check if sender is an owner
        const isOwner = terra.config.owners.includes(participantJid.split('@')[0]);
        
        // Check if sender is a group admin (if in a group)
        let isAdmin = false;
        if (isGroup) {
          try {
            const groupMetadata = await terra.groupManager.getGroupMetadata(sender);
            const participant = groupMetadata.participants.find(p => p.id === participantJid);
            isAdmin = participant && ['admin', 'superadmin'].includes(participant.admin);
          } catch (error) {
            terra.logger.error(`Error checking admin status: ${error.message}`);
          }
        }
        
        hasPermission = isOwner || isAdmin;
        
        // If no permission and private mode enabled, ignore message
        if (!hasPermission) {
          terra.logger.debug(`Ignoring message from ${senderName} (private mode)`);
          return;
        }
      }
      
      // Process for XP if this is a group message (at least 3 chars and not a command)
      if (isGroup && 
          terra.config.leveling?.enabled && 
          content.length >= terra.levelManager.minMessageLength && 
          !content.startsWith(terra.config.prefix)) {
        
        const xpResult = await terra.levelManager.processMessage(msg, content);
        
        // If user leveled up and level-up messages are enabled, send notification
        if (xpResult && 
            xpResult.leveledUp && 
            terra.config.leveling.levelUpMessages) {
          
          terra.socket.sendMessage(
            sender,
            {
              text: `🎉 Congrats @${xpResult.userId}! You've reached level ${xpResult.newLevel}!`,
              mentions: [`${xpResult.userId}@s.whatsapp.net`]
            }
          );
        }
      }
      
      // Check if the message is a command
      if (content.startsWith(terra.config.prefix)) {
        terra.logger.debug(`Detected command: ${content}`);
        
        // Pass the message to the command handler for processing
        try {
          await terra.commandHandler.handleMessage(msg);
        } catch (error) {
          terra.logger.error(`Error executing command: ${error.message}`);
          await terra.reply(msg, `❌ Error executing command: ${error.message}`);
        }
      }
    }
  }
};