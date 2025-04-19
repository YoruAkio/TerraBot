module.exports = {
  name: "equip",
  description: "Equip or use an item from your inventory",
  aliases: ["wear", "use"],
  usage: "{prefix}equip <item_id>",
  cooldown: 3,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Check if item ID is provided
      if (!args[0]) {
        return terra.reply(msg, `❌ Please specify an item to equip or use. Example: ${terra.prefix}equip sword_1`);
      }
      
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      const itemId = args[0].toLowerCase();
      
      // Try to equip or use the item
      const result = await adventure.equipItem(context.sender, itemId);
      
      // Send result message
      return terra.reply(msg, result.message);
    } catch (error) {
      terra.logger.error("Error in equip command: " + error);
      return terra.reply(msg, "❌ Error equipping item. Please try again later.");
    }
  }
};