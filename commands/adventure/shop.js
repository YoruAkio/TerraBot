module.exports = {
  name: "shop",
  description: "Buy items and equipment for your adventure",
  aliases: ["store", "market"],
  usage: "{prefix}shop [buy <item_id>]",
  cooldown: 3,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // Get user adventure data
      const userData = await adventure.getUserData(context.sender);
      
      // Handle buy command
      if (args[0]?.toLowerCase() === "buy" && args[1]) {
        const itemId = args[1].toLowerCase();
        const result = await adventure.buyItem(context.sender, itemId);
        return terra.reply(msg, result.message);
      }
      
      // Display the shop with categories - improved formatting
      const shopItems = adventure.getShopItems(userData.level);
      let shopText = `*🛒 ADVENTURE SHOP 🛒*\n\n`;
      shopText += `Your gold: ${userData.inventory.gold} 💰\n\n`;
      
      // Group items by type
      const categories = {
        weapon: "⚔️ *WEAPONS*",
        armor: "🛡️ *ARMOR*",
        accessory: "💍 *ACCESSORIES*",
        consumable: "🧪 *CONSUMABLES*"
      };
      
      // Build shop display with better formatting
      for (const [type, title] of Object.entries(categories)) {
        const items = shopItems.filter(item => item.type === type);
        
        if (items.length > 0) {
          shopText += `${title}\n`;
          
          items.forEach(item => {
            shopText += `• ${item.name} ${item.image || ''}: ${item.value} gold`;
            shopText += item.required_level > 1 ? ` (Level ${item.required_level}+)` : "";
            shopText += ` [ID: ${item.id}]\n`;
          });
          
          shopText += "\n";
        }
      }
      
      shopText += `_To buy an item, type: ${terra.prefix}shop buy <item_id>_\n`;
      shopText += `Example: ${terra.prefix}shop buy sword_1`;
      
      return terra.reply(msg, shopText);
    } catch (error) {
      terra.logger.error("Error in shop command: " + error);
      return terra.reply(msg, "❌ Error accessing the shop. Please try again later.");
    }
  }
};