module.exports = {
  name: "travel",
  description: "Travel to a different location",
  aliases: ["goto", "move", "location"],
  usage: "{prefix}travel <location_id> or {prefix}travel list",
  cooldown: 5,
  category: "adventure",
  execute: async (terra, msg, args, context) => {
    try {
      // Access adventure manager directly
      const adventure = terra.adventureManager;
      
      if (!adventure) {
        return terra.reply(msg, "❌ Adventure system is not available right now. Please try again later.");
      }
      
      // If no args, or "list" arg - show available locations
      if (!args[0] || args[0].toLowerCase() === "list") {
        const locations = adventure.getLocations();
        let locationText = `*🗺️ AVAILABLE LOCATIONS 🗺️*\n\n`;
        
        locations.forEach(location => {
          locationText += `• ${location.name} ${location.image || ''} [ID: ${location.id}]`;
          if (location.minLevel > 1) {
            locationText += ` (Level ${location.minLevel}+)`;
          }
          if (location.safeZone) {
            locationText += " (Safe Zone)";
          }
          locationText += `\n`;
        });
        
        locationText += `\n_To travel, use: ${terra.prefix}travel <location_id>_\n`;
        locationText += `Example: ${terra.prefix}travel forest`;
        
        return terra.reply(msg, locationText);
      }
      
      // Travel to location
      const locationId = args[0].toLowerCase();
      const result = await adventure.travel(context.sender, locationId);
      
      // Send result message
      return terra.reply(msg, result.message);
    } catch (error) {
      terra.logger.error("Error in travel command: " + error);
      return terra.reply(msg, "❌ Error traveling to location. Please try again later.");
    }
  }
};