import { category } from "./profile";

module.exports = {
  name: "level",
  description: "Display your level and XP progress",
  aliases: ["lvl", "rank", "xp"],
  usage: "{prefix}level [@mention]",
  cooldown: 5,
  category: "fun",
  execute: async (terra, msg, args, context) => {
    try {
      // Determine target user (mentioned or command sender)
      let targetJid = context.sender;

      // Check if a user was mentioned
      if (
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
      }

      // Get target user data
      const cleanTargetJid = targetJid.split("@")[0];

      // Get user's name
      let userName;
      try {
        userName = await terra.getUserName(msg);
      } catch (error) {
        userName = cleanTargetJid;
      }

      // Get level data
      const userData = terra.levelManager.getUserData(cleanTargetJid);

      // Get user's rank
      const rank = terra.levelManager.getUserRank(cleanTargetJid);

      // Get progress information
      const progress = terra.levelManager.getProgress(
        userData.level,
        userData.xp
      );
      const progressBar = terra.levelManager.createProgressBar(
        progress.percentage,
        15
      );

      // Create message
      let message = `*📊 Level Stats for @${cleanTargetJid}*\n\n`;
      message += `🏆 *Global Rank:* #${rank}\n`;
      message += `⭐ *Level:* ${userData.level}`;

      if (progress.isMaxLevel) {
        message += " (MAX)";
      }

      message += `\n📈 *Total XP:* ${userData.xp}\n`;

      if (!progress.isMaxLevel) {
        message += `🔄 *Progress:* [${progressBar}] ${progress.percentage}%\n`;
        message += `(${progress.currentXp}/${progress.neededXp} XP)\n`;
      } else {
        message += `🔄 *Progress:* Maximum level reached!\n`;
      }

      message += `💬 *Messages:* ${userData.messages}\n`;
      message += `⏱️ *Active Since:* ${new Date(
        userData.joinedAt || Date.now()
      ).toLocaleDateString()}`;

      // Send the message with mentions
      return terra.socket.sendMessage(
        msg.key.remoteJid,
        {
          text: message,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    } catch (error) {
      terra.logger.error("Error in level command:", error);
      return terra.reply(msg, `❌ Error checking level: ${error.message}`);
    }
  },
};
