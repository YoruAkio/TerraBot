module.exports = {
  name: 'leaderboard',
  description: 'Display the top users by level',
  aliases: ['lb', 'top', 'ranks'],
  usage: '{prefix}leaderboard [number]',
  cooldown: 10,
  category: 'fun',
  execute: async (terra, msg, args, context) => {
    try {
      // Number of users to show (default 10, max 20)
      let limit = 10;
      if (args.length > 0 && !isNaN(args[0])) {
        limit = Math.min(Math.max(parseInt(args[0]), 1), 20);
      }
      
      // Get top users
      const topUsers = terra.levelManager.getTopUsers(limit);
      
      if (topUsers.length === 0) {
        return terra.reply(msg, '❌ No users have earned XP yet.');
      }
      
      // Find the rank of the requester
      const requesterId = context.sender.split('@')[0];
      const requesterRank = topUsers.findIndex(user => user.userId === requesterId) + 1;
      
      // Format leaderboard message
      let leaderboardText = `*🏆 Global XP Leaderboard*\n*Top ${topUsers.length} Users*\n\n`;
      
      // Build leaderboard entries
      const mentions = [];
      for (let i = 0; i < topUsers.length; i++) {
        const user = topUsers[i];
        const userJid = `${user.userId}@s.whatsapp.net`;
        mentions.push(userJid);
        
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const maxLevelIndicator = user.level >= terra.levelManager.maxLevel ? " (MAX)" : "";
        
        leaderboardText += `${medal} @${user.userId} - Level ${user.level}${maxLevelIndicator} (${user.xp.toLocaleString()} XP)\n`;
      }
      
      // Add the requester's rank if not in top users
      if (requesterRank === 0) {
        // Get user's actual rank
        const actualRank = terra.levelManager.getUserRank(requesterId);
        
        if (actualRank > 0) {
          const userData = terra.levelManager.getUserData(requesterId);
          leaderboardText += `\n*Your Rank:* #${actualRank} - Level ${userData.level} (${userData.xp.toLocaleString()} XP)`;
          mentions.push(`${requesterId}@s.whatsapp.net`);
        }
      }
      
      // Send the message with mentions
      return terra.socket.sendMessage(
        msg.key.remoteJid,
        {
          text: leaderboardText,
          mentions: mentions
        },
        { quoted: msg }
      );
      
    } catch (error) {
      terra.logger.error('Error in leaderboard command:', error);
      return terra.reply(msg, `❌ Error showing leaderboard: ${error.message}`);
    }
  }
};