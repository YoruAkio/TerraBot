module.exports = {
  name: 'debug',
  description: 'Debug information',
  ownerOnly: true, // Restrict to owner
  execute: async (terra, msg, args, context) => {
    const commandCount = terra.commandHandler.commands.size;
    const categoryCount = terra.commandHandler.categories.size;
    const commandsList = Array.from(terra.commandHandler.commands.keys());
    const categoriesList = Array.from(terra.commandHandler.categories.keys());
    
    let debugInfo = '*🔍 Debug Information*\n\n';
    debugInfo += `*Commands loaded:* ${commandCount}\n`;
    debugInfo += `*Categories:* ${categoryCount}\n`;
    debugInfo += `*Commands:* ${commandsList.join(', ')}\n`;
    debugInfo += `*Categories:* ${categoriesList.join(', ')}\n\n`;
    
    // Context information
    debugInfo += '*Context:*\n';
    debugInfo += `isGroup: ${context.isGroup}\n`;
    debugInfo += `isOwner: ${context.isOwner}\n`;
    debugInfo += `isAdmin: ${context.isAdmin}\n\n`;

    // Message information
    debugInfo += '*Message Information:*\n';
    debugInfo += `From: ${msg.key.remoteJid}\n`;
    debugInfo += `Sender: ${msg.key.participant || msg.key.remoteJid}\n`;
    debugInfo += `Message ID: ${msg.key.id}\n`;
    debugInfo += `Timestamp: ${msg.messageTimestamp}\n`;
    debugInfo += `Message Type: ${Object.keys(msg.message)[0]}\n\n`;

    // Debug user information
    debugInfo += '*User Information:*\n';
    debugInfo += `User ID: ${msg.key.remoteJid}\n`;
    debugInfo += `User Name: ${context.name}\n`;
    debugInfo += `User JID: ${msg.key.participant || msg.key.remoteJid}\n`;
    debugInfo += `User Phone Number: ${terra.getUserPhoneNumber(msg.key.remoteJid)}\n`;
    
    return terra.reply(msg, debugInfo);
  }
};