const CanvasManager = require("../../utils/CanvasManager");

module.exports = {
  name: "adventureprofile",
  description: "View your adventure profile stats",
  aliases: ["aprofile", "astats", "rpg"],
  usage: "{prefix}adventureprofile",
  cooldown: 5,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;

      if (!adventure) {
        return terra.reply(
          msg,
          "❌ Adventure system is not available right now. Please try again later."
        );
      }

      // Get user adventure data
      const userData = await adventure.getUserData(msg.key.participant || msg.key.remoteJid);
      console.log("UserData:", userData);

      // Get location info
      const location = adventure.locations?.get(userData.location);
      const locationName = location ? location.name : "Unknown";
      const locationImage = location ? location.image || "" : "";

      // Calculate time remaining for activities
      const now = Date.now();
      const cooldowns = [];

      if (args[0] === "card" || args[0] === "image") {
        try {
          // Show processing message
          await terra.reply(msg, "⏳ Generating your adventure card...");

          // Initialize canvas manager
          const canvasManager = new CanvasManager();

          // Try to get profile picture
          let profilePic = null;
          try {
            profilePic = await canvasManager.getProfilePicture(
              terra.socket,
              msg.key.participant || msg.key.remoteJid
            );
          } catch (ppError) {
            terra.logger.error(
              `Error fetching profile picture: ${ppError.message}`
            );
            // We'll continue without a profile picture
          }

          // Get equipment info for the card
          const equipmentInfo = {
            weapon: userData.equipment.weapon
              ? adventure.getItemInfo(userData.equipment.weapon)
              : null,
            armor: userData.equipment.armor
              ? adventure.getItemInfo(userData.equipment.armor)
              : null,
            accessory: userData.equipment.accessory
              ? adventure.getItemInfo(userData.equipment.accessory)
              : null,
          };

          // Get location info
          const location = adventure.locations?.get(userData.location);
          const locationInfo = {
            name: location?.name || "Unknown",
            image: location?.image || "",
          };

          terra.logger.info(`UserData: ${JSON.stringify(userData)}`);

          // Generate the adventure card
          const cardBuffer = await canvasManager.createAdventureCard(userData, {
            profilePic,
            equipmentInfo,
            locationInfo,
          });

          if (!cardBuffer) {
            return terra.reply(msg, "❌ Failed to generate adventure card.");
          }

          // Send the image
          await terra.socket.sendMessage(
            msg.key.remoteJid,
            {
              image: cardBuffer,
              caption: `🎮 Adventure card for ${userData.name || "Adventurer"}`,
              mimetype: "image/png",
            },
            { quoted: msg }
          );

          return;
        } catch (cardError) {
          terra.logger.error("Error generating adventure card: " + cardError);
          return terra.reply(
            msg,
            "❌ Error generating adventure card. Using text mode instead."
          );
        }
      }

      if (userData.cooldowns.hunt > now) {
        const timeLeft = Math.ceil((userData.cooldowns.hunt - now) / 1000);
        cooldowns.push(`Hunt: ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`);
      }

      if (userData.cooldowns.train > now) {
        const timeLeft = Math.ceil((userData.cooldowns.train - now) / 1000);
        const minutes = Math.floor(timeLeft / 60);
        cooldowns.push(`Train: ${Math.floor(minutes / 60)}h ${minutes % 60}m`);
      }

      if (userData.cooldowns.daily > now) {
        const timeLeft = Math.ceil((userData.cooldowns.daily - now) / 1000);
        const hours = Math.floor(timeLeft / 3600);
        cooldowns.push(
          `Daily: ${hours}h ${Math.floor((timeLeft % 3600) / 60)}m`
        );
      }

      // Format profile message with better visual design
      let profileText = `*🌟 ADVENTURE PROFILE 🌟*\n\n`;
      profileText += `👤 *Character:* ${userData.name || "Adventurer"}\n`;
      profileText += `🏆 *Level:* ${userData.level} (${userData.xp}/${userData.xpNeeded} XP)\n`;
      profileText += `💰 *Gold:* ${userData.inventory.gold}\n`;
      profileText += `📍 *Location:* ${locationName} ${locationImage}\n`;
      profileText += `💪 *Monsters Defeated:* ${
        userData.monstersDefeated || 0
      }\n\n`;

      profileText += `*📊 STATS*\n`;
      profileText += `❤️ HP: ${userData.stats.health}/${userData.stats.maxHealth}\n`;
      profileText += `⚔️ Attack: ${userData.stats.attack}\n`;
      profileText += `🛡️ Defense: ${userData.stats.defense}\n`;
      profileText += `⚡ Speed: ${userData.stats.speed}\n\n`;

      if (cooldowns.length > 0) {
        profileText += `*⏳ COOLDOWNS*\n`;
        profileText += cooldowns.join("\n") + "\n\n";
      }

      profileText += `*🎮 AVAILABLE COMMANDS*\n`;
      profileText += `• ${terra.prefix}hunt - Hunt for monsters and treasures\n`;
      profileText += `• ${terra.prefix}shop - Buy equipment and items\n`;
      profileText += `• ${terra.prefix}inventory - View your items and equipment\n`;
      profileText += `• ${terra.prefix}equip <item_id> - Use or equip an item\n`;
      profileText += `• ${terra.prefix}train - Train to gain XP\n`;
      profileText += `• ${terra.prefix}travel - Change your location\n`;
      profileText += `• ${terra.prefix}daily - Claim daily rewards\n`;

      return terra.reply(msg, profileText);
    } catch (error) {
      terra.logger.error("Error in adventure profile command: " + error);
      return terra.reply(
        msg,
        "❌ Error accessing your adventure profile. Please try again later."
      );
    }
  },
};
