module.exports = {
  name: "inventory",
  description: "View your adventure inventory",
  aliases: ["inv", "i", "bag"],
  usage: "{prefix}inventory",
  cooldown: 5,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly from terra instance
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // Get or create user adventure data
      const userData = await adventure.getUserData(context.sender);
      
      // Add character name and header with better formatting
      let inventoryText = `*🎒 ADVENTURE INVENTORY 🎒*\n\n`;
      
      // Character section with better visual separation
      inventoryText += `*👤 CHARACTER*\n`;
      inventoryText += `Name: ${userData.name || "Adventurer"}\n`;
      inventoryText += `Level: ${userData.level} (${userData.xp}/${userData.xpNeeded} XP)\n`;
      inventoryText += `Gold: ${userData.inventory.gold}💰\n\n`;
      
      // Stats section with cleaner formatting
      inventoryText += `*📊 STATS*\n`;
      inventoryText += `❤️ Health: ${userData.stats.health}/${userData.stats.maxHealth}\n`;
      inventoryText += `⚔️ Attack: ${userData.stats.attack}\n`;
      inventoryText += `🛡️ Defense: ${userData.stats.defense}\n`;
      inventoryText += `⚡ Speed: ${userData.stats.speed}\n\n`;
      
      // Equipment section with better visual formatting
      inventoryText += `*⚔️ EQUIPMENT*\n`;
      
      // Weapon
      const weaponItem = userData.equipment.weapon ? 
          adventure.getItemInfo(userData.equipment.weapon) : null;
      inventoryText += `🗡️ Weapon: ${weaponItem ? `${weaponItem.name} ${weaponItem.image || ''}` : "None"}\n`;
      
      // Armor
      const armorItem = userData.equipment.armor ? 
          adventure.getItemInfo(userData.equipment.armor) : null;
      inventoryText += `🧥 Armor: ${armorItem ? `${armorItem.name} ${armorItem.image || ''}` : "None"}\n`;
      
      // Accessory
      const accessoryItem = userData.equipment.accessory ? 
          adventure.getItemInfo(userData.equipment.accessory) : null;
      inventoryText += `💍 Accessory: ${accessoryItem ? `${accessoryItem.name} ${accessoryItem.image || ''}` : "None"}\n\n`;
      
      // Items with better formatting
      inventoryText += `*🎒 ITEMS*\n`;
      if (!userData.inventory.items || userData.inventory.items.length === 0) {
        inventoryText += "No items yet. Go on an adventure to find some!\n";
      } else {
        userData.inventory.items.forEach(item => {
          const itemInfo = adventure.getItemInfo(item.id);
          if (itemInfo) {
            inventoryText += `• ${itemInfo.name} ${itemInfo.image || ''} (${item.quantity})\n`;
          }
        });
      }
      
      // Location info
      const location = adventure.locations?.get(userData.location);
      if (location) {
        inventoryText += `\n📍 *Location:* ${location.name} ${location.image || ''}`;
      }
      
      // Footer with tip for better UX
      inventoryText += `\n\n_Use ${terra.prefix}equip <item_id> to equip items_`;
      
      // Send the formatted inventory message
      return terra.reply(msg, inventoryText);
    } catch (error) {
      terra.logger.error("Error in inventory command: " + error);
      return terra.reply(msg, "❌ Error accessing your inventory. Please try again later.");
    }
  }
};