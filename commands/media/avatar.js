module.exports = {
  name: 'avatar',
  description: 'Display user profile picture',
  aliases: ['pfp', 'dp', 'profile'],
  usage: '{prefix}avatar [@mention or reply]',
  cooldown: 5,
  category: 'general',
  execute: async (terra, msg, args, context) => {
    try {
      let targetJid;
      let caption = '';
      
      // Handle different ways to specify a user
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        // If someone is mentioned in the message
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        // If the message is a reply to someone
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
      } else {
        // Default to the sender
        targetJid = msg.key.participant || msg.key.remoteJid;
      }
      
      // Get user name
      const username = await terra.getUserName(msg);
      caption = `🖼️ Profile picture of *${username}*`;
      
      // Send typing indicator safely (with fallbacks)
      try {
        // Check if sendPresenceUpdate exists on terra or socket
        if (typeof terra.sendPresenceUpdate === 'function') {
          await terra.sendPresenceUpdate('composing', msg.key.remoteJid);
        } else if (terra.socket && typeof terra.socket.sendPresenceUpdate === 'function') {
          await terra.socket.sendPresenceUpdate('composing', msg.key.remoteJid);
        } else {
          // Just log and continue if typing indicator isn't available
          terra.logger.debug('Typing indicator not available');
        }
      } catch (presenceError) {
        // Don't let typing indicator errors stop the command
        terra.logger.debug('Error sending typing indicator:', presenceError.message);
      }
      
      // Try to get profile picture URL
      const ppUrl = await terra.contactManager.getProfilePicture(targetJid);
      
      if (ppUrl) {
        // Download and send profile picture
        const buffer = await terra.messageUtils.getBuffer(ppUrl);
        return await terra.messageUtils.sendImage(msg.key.remoteJid, buffer, caption, { quoted: msg });
      } else {
        // Send default avatar if no profile picture is found
        const defaultAvatar = './assets/images/default-avatar.png';
        
        // Ensure default avatar exists
        const fs = require('fs-extra');
        
        if (!await fs.pathExists(defaultAvatar)) {
          // Create assets directory if it doesn't exist
          await fs.ensureDir('./assets/images');
          
          // Generate a simple default avatar
          await createDefaultAvatar(defaultAvatar, username);
        }
        
        caption += '\n(No profile picture found, showing default avatar)';
        return await terra.messageUtils.sendImage(msg.key.remoteJid, defaultAvatar, caption, { quoted: msg });
      }
    } catch (error) {
      terra.logger.error('Error in avatar command:', error);
      return terra.reply(msg, `❌ Error getting profile picture: ${error.message}`);
    }
  }
};

/**
 * Create a default avatar image with user initials
 * @param {string} outputPath Path to save the image
 * @param {string} username Username to use for initials
 * @returns {Promise<void>}
 */
async function createDefaultAvatar(outputPath, username) {
  const { createCanvas } = require('canvas');
  
  // If canvas module is not available, fallback method
  if (!createCanvas) {
    const fs = require('fs-extra');
    const axios = require('axios');
    
    // Get a placeholder avatar from DiceBear API
    const seed = username.replace(/[^a-zA-Z0-9]/g, '');
    const apiUrl = `https://api.dicebear.com/6.x/initials/png?seed=${seed}&backgroundColor=random`;
    
    try {
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(outputPath, Buffer.from(response.data));
    } catch (error) {
      // If API fails, create a simple colored square
      const canvas = createFallbackCanvas();
      const ctx = canvas.getContext('2d');
      
      // Generate a color based on username
      const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hue = hash % 360;
      
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(0, 0, 200, 200);
      
      // Save image
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(outputPath, buffer);
    }
    return;
  }
  
  // If canvas is available, create a nicer avatar
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  
  // Generate background color based on username
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  
  // Fill background
  ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
  ctx.fillRect(0, 0, 200, 200);
  
  // Get initials (up to 2 characters)
  const initials = username
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word[0].toUpperCase())
    .slice(0, 2)
    .join('');
  
  // Draw text
  ctx.fillStyle = 'white';
  ctx.font = '80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials || '?', 100, 100);
  
  // Save image
  const buffer = canvas.toBuffer('image/png');
  const fs = require('fs-extra');
  await fs.writeFile(outputPath, buffer);
}

/**
 * Create a simple canvas for fallback
 * @returns {object} Simple canvas object with basic rendering methods
 */
function createFallbackCanvas() {
  return {
    width: 200,
    height: 200,
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
    }),
    toBuffer: () => Buffer.alloc(100)
  };
}