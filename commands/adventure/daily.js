module.exports = {
  name: "daily",
  description: "Claim your daily adventure rewards",
  aliases: ["claim", "reward"],
  usage: "{prefix}daily",
  cooldown: 10,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // Claim daily reward
      const result = await adventure.claimDaily(context.sender);
      
      // Send result message
      return terra.reply(msg, result.message);
    } catch (error) {
      terra.logger.error("Error in daily command: " + error);
      return terra.reply(msg, "❌ Error claiming daily reward. Please try again later.");
    }
  }
};