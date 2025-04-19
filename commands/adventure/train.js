module.exports = {
  name: "train",
  description: "Train to gain XP for your adventure character",
  aliases: ["workout", "practice"],
  usage: "{prefix}train",
  cooldown: 5,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // Perform the training
      const trainingResult = await adventure.train(context.sender);
      
      // Send result message
      return terra.reply(msg, trainingResult.message);
    } catch (error) {
      terra.logger.error("Error in train command: " + error);
      return terra.reply(msg, "❌ Error during training. Please try again later.");
    }
  }
};