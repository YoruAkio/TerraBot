const os = require('os');
const { version: baileyVersion } = require('@whiskeysockets/baileys/package.json');

module.exports = {
  name: 'info',
  description: 'Show bot information and statistics',
  aliases: ['stats', 'about', 'botinfo'],
  cooldown: 10,
  category: 'general',
  execute: async (terra, msg, args) => {
    // Get basic stats from terra
    const stats = terra.getStats();
    const { uptime, formattedUptime, messages } = stats;
    
    // Get runtime information
    const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.versions.node}`;
    
    // Calculate message ratio
    const messageRatio = messages.sent > 0 ? (messages.received / messages.sent).toFixed(1) : 0;
    
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 10) / 10;
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 10) / 10;
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    // Count loaded commands
    const commandCount = terra.commandHandler ? 
      Array.from(terra.commandHandler.commands.values())
        .filter((cmd, i, self) => self.findIndex(c => c.name === cmd.name) === i).length : 
      'N/A';
    
    // Count categories
    const categories = terra.commandHandler ? 
      new Set(Array.from(terra.commandHandler.commands.values())
        .map(cmd => cmd.category || 'uncategorized')).size : 
      'N/A';
    
    // Format uptime in a more readable way
    const uptimeDate = new Date(0);
    uptimeDate.setSeconds(uptime);
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = uptimeDate.getUTCHours();
    const minutes = uptimeDate.getUTCMinutes();
    const seconds = uptimeDate.getUTCSeconds();
    
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    
    // Generate system load percentage (between 0-100)
    const loadAvg = Math.round((os.loadavg()[0] / os.cpus().length) * 100);
    
    // Build nicely formatted info message
    let infoText = `*🤖 ${terra.config.name || 'TerraBot'} Information*\n\n`;
    
    // Bot section
    infoText += `*━━━━ Bot Details ━━━━*\n`;
    infoText += `👤 *Name:* ${terra.config.name || 'TerraBot'}\n`;
    infoText += `⚡ *Runtime:* ${runtime}\n`;
    infoText += `🔌 *Baileys:* v${baileyVersion}\n`;
    infoText += `🧩 *Commands:* ${commandCount} (${categories} categories)\n`;
    infoText += `✅ *Status:* ${terra.isConnected ? 'Connected' : 'Disconnected'}\n\n`;
    
    // Performance section
    infoText += `*━━━━ Performance ━━━━*\n`;
    infoText += `⏱️ *Uptime:* ${uptimeStr}\n`;
    infoText += `🧠 *Memory:* ${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryPercentage}%)\n`;
    infoText += `⚙️ *System Load:* ${loadAvg}%\n\n`;
    
    // Statistics section
    infoText += `*━━━━ Statistics ━━━━*\n`;
    infoText += `📥 *Messages Received:* ${messages.received.toLocaleString()}\n`;
    infoText += `📤 *Messages Sent:* ${messages.sent.toLocaleString()}\n`;
    infoText += `📊 *Msg Ratio:* ${messageRatio}:1 (received:sent)\n\n`;
    
    // Serve through thumbnail if possible
    try {
      // Try to send with rich preview
      const response = await terra.sendMessage(msg.key.remoteJid, {
        text: infoText,
        contextInfo: {
          externalAdReply: {
            title: `${terra.config.name || 'TerraBot'} Statistics`,
            body: `Runtime: ${uptimeStr}`,
            mediaType: 1,
            showAdAttribution: false,
            sourceUrl: terra.config.website || '',
          }
        }
      }, { quoted: msg });
      return response;
    } catch (error) {
      // Fall back to simple reply
      return terra.reply(msg, infoText);
    }
  }
};