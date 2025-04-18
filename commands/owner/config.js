module.exports = {
  name: 'config',
  description: 'Configure bot settings',
  aliases: ['settings', 'setting'],
  usage: '{prefix}config [setting] [value]',
  ownerOnly: true,
  execute: async (terra, msg, args, context) => {
    // If no arguments, show current config
    if (!args.length) {
      const configInfo = `*🤖 Bot Configuration*\n\n` +
        `• Private Mode: ${terra.config.privateMode ? '✅ ON' : '❌ OFF'}\n` +
        `• Leveling System: ${terra.config.leveling?.enabled ? '✅ ON' : '❌ OFF'}\n` +
        `• Level-Up Messages: ${terra.config.leveling?.levelUpMessages ? '✅ ON' : '❌ OFF'}\n`;
      
      return terra.reply(msg, configInfo);
    }
    
    // Handle specific settings
    const setting = args[0].toLowerCase();
    const value = args[1]?.toLowerCase();
    
    try {
      // Update settings based on command
      if (setting === 'privatemode' || setting === 'private') {
        if (value === 'on' || value === 'true') {
          terra.config.privateMode = true;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Private mode has been *enabled*. Bot will only respond to owners and admins.');
        } else if (value === 'off' || value === 'false') {
          terra.config.privateMode = false;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Private mode has been *disabled*. Bot will respond to everyone.');
        } else {
          return terra.reply(msg, `❌ Invalid value. Use 'on' or 'off'.`);
        }
      } 
      
      else if (setting === 'leveling' || setting === 'level') {
        if (!terra.config.leveling) terra.config.leveling = {};
        
        if (value === 'on' || value === 'true') {
          terra.config.leveling.enabled = true;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Leveling system has been *enabled*.');
        } else if (value === 'off' || value === 'false') {
          terra.config.leveling.enabled = false;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Leveling system has been *disabled*.');
        } else {
          return terra.reply(msg, `❌ Invalid value. Use 'on' or 'off'.`);
        }
      } 
      
      else if (setting === 'levelupmessages' || setting === 'levelupmsg' || setting === 'levelup') {
        if (!terra.config.leveling) terra.config.leveling = {};
        
        if (value === 'on' || value === 'true') {
          terra.config.leveling.levelUpMessages = true;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Level-up messages have been *enabled*.');
        } else if (value === 'off' || value === 'false') {
          terra.config.leveling.levelUpMessages = false;
          await terra.saveConfig();  // Save changes
          return terra.reply(msg, '✅ Level-up messages have been *disabled*.');
        } else {
          return terra.reply(msg, `❌ Invalid value. Use 'on' or 'off'.`);
        }
      }
      
      else {
        return terra.reply(msg, `❌ Unknown setting: ${setting}\n\nAvailable settings:\n- privatemode\n- leveling\n- levelupmessages`);
      }
    } catch (error) {
      terra.logger.error(`Error saving configuration: ${error.message}`);
      return terra.reply(msg, `⚠️ Setting was changed but there was an error saving the configuration: ${error.message}`);
    }
  }
};