module.exports = {
  name: "hunt",
  description: "Go hunting for monsters and treasure",
  aliases: ["adventure", "explore"],
  usage: "{prefix}hunt",
  cooldown: 5,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // Go hunting
      const huntResult = await adventure.hunt(context.sender);
      
      // Format and send the result message
      return terra.reply(msg, huntResult.message);
    } catch (error) {
      terra.logger.error("Error in hunt command: " + error);
      return terra.reply(msg, "❌ Error during your hunt. Please try again later.");
    }
  }
};