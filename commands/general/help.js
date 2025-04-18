module.exports = {
  name: "help",
  description: "Display available commands or command info",
  aliases: ["h", "menu", "commands"],
  usage: "{prefix}help [command] | {prefix}help category:[category]",
  cooldown: 5,
  category: "general",
  execute: async (terra, msg, args, context = {}) => {
    const { prefix } = terra.config;

    // Custom labels for commands and messages
    const labels = {
      commands: {},
      messages: {
        header: "*🤖 TerraBot Command Center*",
        footer:
          "✨ Use *{prefix}help <command>* for detailed info on any command.",
        notFound:
          "❌ Command *{command}* not found. Try *{prefix}help* to see all commands.",
        ownerOnly: "👑 Owner-only command",
        groupOnly: "👥 Group-only command",
        privateOnly: "💌 Private chat only command",
        examples: "💡 Examples:",
        categoryHeader: "━━━━━ *{category}* ━━━━━",
        stats: "*🔎 {totalCommands}* commands across *{categories}* categories",
      },
    };

    // Let system store custom labels
    if (!terra.helpLabels) {
      terra.helpLabels = labels;
    }

    // Add or update command label
    terra.addCommandLabel = (commandName, label) => {
      if (!terra.helpLabels) terra.helpLabels = labels;
      terra.helpLabels.commands[commandName] = label;
    };

    // Add or update message label
    terra.addMessageLabel = (labelKey, text) => {
      if (!terra.helpLabels) terra.helpLabels = labels;
      terra.helpLabels.messages[labelKey] = text;
    };

    // Helper to get label with variable substitution
    const getLabel = (key, vars = {}) => {
      let text = terra.helpLabels?.messages[key] || labels.messages[key] || key;
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
      return text;
    };

    // If arg starts with "category:", filter by that category
    if (args.length > 0 && args[0].startsWith("category:")) {
      const requestedCategory = args[0].substring(9).toLowerCase();
      return showCategoryCommands(requestedCategory);
    }

    // If no command specified, show all commands
    if (!args.length) {
      return showAllCommands();
    } else {
      // Show info about specific command
      const commandName = args[0].toLowerCase();
      return showCommandDetails(commandName);
    }

    // Function to show all commands grouped by category
    async function showAllCommands() {
      // Group commands by category
      const categories = {};
      const commandNames = new Set();
      let totalCommands = 0;

      for (const [name, cmd] of terra.commandHandler.commands.entries()) {
        // Skip aliases
        if (commandNames.has(cmd.name)) continue;
        commandNames.add(cmd.name);
        totalCommands++;

        const category = cmd.category || "uncategorized";
        if (!categories[category]) {
          categories[category] = [];
        }

        categories[category].push({
          name: cmd.name,
          description: cmd.description || "No description",
          ownerOnly: !!cmd.ownerOnly,
          groupOnly: !!cmd.groupOnly,
          privateOnly: !!cmd.privateOnly,
        });
      }

      let helpMessage = `${getLabel("header")}\n\n`;

      // Add stats
      helpMessage += `${getLabel("stats", {
        totalCommands: totalCommands,
        categories: Object.keys(categories).length,
      })}\n\n`;

      // Add commands by category
      for (const [category, cmds] of Object.entries(categories)) {
        if (cmds.length === 0) continue;

        const catName = category.charAt(0).toUpperCase() + category.slice(1);
        const catEmoji = getCategoryEmoji(category);
        helpMessage += `${getLabel("categoryHeader", {
          category: `${catEmoji} ${catName}`,
        })}\n`;

        for (const cmd of cmds) {
          const customLabel = terra.helpLabels?.commands[cmd.name] || "";
          const badges = [];

          if (cmd.ownerOnly) badges.push("👑");
          if (cmd.groupOnly) badges.push("👥");
          if (cmd.privateOnly) badges.push("💌");

          const badgeText = badges.length > 0 ? ` ${badges.join("")}` : "";
          const cmdLabel = customLabel ? ` (${customLabel})` : "";

          helpMessage += `  • *${prefix}${cmd.name}*${cmdLabel}${badgeText} - ${cmd.description}\n`;
        }

        helpMessage += "\n";
      }

      helpMessage += getLabel("footer", { prefix });
      // return terra.reply(msg, helpMessage, { quoted: msg });
      return terra.socket.sendMessage(
        msg.key.remoteJid,
        {
          text: helpMessage,
          contextInfo: {
            isForwarding: true,
            forwardingScore: 999,
            mentionedJid: [msg.key.participant],
            stanzaId: msg.key.id,
            externalAdReply: {
              title: "TerraBot Command Center",
              body: "Use the command center to explore all available commands.",
              mediaType: 1,
              showAdAttribution: true,
              renderLargerThumbnail: true,
              thumbnailUrl: "https://raw.githubusercontent.com/YoruAkio/YoruAkio/refs/heads/main/yoruakio.png",
              sourceUrl: terra.config.website || "https://akio.lol"
            },
            sendEphemeral: true,
          },
        },
        { quoted: msg }
      );
    }

    // Function to show commands for a specific category
    async function showCategoryCommands(category) {
      const commands = Array.from(terra.commandHandler.commands.values())
        .filter(
          (cmd) => (cmd.category || "uncategorized").toLowerCase() === category
        )
        // Remove duplicates (aliases)
        .filter(
          (cmd, index, self) =>
            index === self.findIndex((c) => c.name === cmd.name)
        );

      if (commands.length === 0) {
        return terra.reply(
          msg,
          `❌ No commands found in category *${category}*`
        );
      }

      const catName = category.charAt(0).toUpperCase() + category.slice(1);
      const catEmoji = getCategoryEmoji(category);
      let helpMessage = `*${catEmoji} ${catName} Commands*\n\n`;

      for (const cmd of commands) {
        const customLabel = terra.helpLabels?.commands[cmd.name] || "";
        const badges = [];

        if (cmd.ownerOnly) badges.push("👑");
        if (cmd.groupOnly) badges.push("👥");
        if (cmd.privateOnly) badges.push("💌");

        const badgeText = badges.length > 0 ? ` ${badges.join("")}` : "";
        const cmdLabel = customLabel ? ` (${customLabel})` : "";

        helpMessage += `• *${prefix}${cmd.name}*${cmdLabel}${badgeText}\n`;
        helpMessage += `  ↳ ${cmd.description || "No description"}\n`;

        if (cmd.aliases && cmd.aliases.length) {
          helpMessage += `  ↳ Aliases: ${cmd.aliases.join(", ")}\n`;
        }

        helpMessage += "\n";
      }

      helpMessage += getLabel("footer", { prefix });
      return terra.reply(msg, helpMessage);
    }

    // Function to show detailed info about a specific command
    async function showCommandDetails(commandName) {
      const command = terra.commandHandler.getCommand(commandName);

      if (!command) {
        return terra.reply(
          msg,
          getLabel("notFound", { command: commandName, prefix })
        );
      }

      const catEmoji = getCategoryEmoji(command.category);
      const customLabel = terra.helpLabels?.commands[command.name] || "";
      const cmdLabel = customLabel ? ` (${customLabel})` : "";

      let helpMessage = `*${catEmoji} Command: ${prefix}${command.name}*${cmdLabel}\n\n`;
      helpMessage += `*Description:* ${
        command.description || "No description"
      }\n\n`;

      // Add badges for special commands
      const badges = [];
      if (command.ownerOnly) badges.push(getLabel("ownerOnly"));
      if (command.groupOnly) badges.push(getLabel("groupOnly"));
      if (command.privateOnly) badges.push(getLabel("privateOnly"));

      if (badges.length > 0) {
        helpMessage += `*Notes:* ${badges.join(", ")}\n\n`;
      }

      if (command.aliases && command.aliases.length) {
        helpMessage += `*Aliases:* ${command.aliases.join(", ")}\n\n`;
      }

      if (command.usage) {
        helpMessage += `*Usage:* ${command.usage.replace(
          "{prefix}",
          prefix
        )}\n\n`;
      }

      // Add examples if available
      if (command.examples && command.examples.length) {
        helpMessage += `${getLabel("examples")}\n`;
        for (const example of command.examples) {
          helpMessage += `  • ${example.replace("{prefix}", prefix)}\n`;
        }
        helpMessage += "\n";
      }

      if (command.cooldown) {
        helpMessage += `*Cooldown:* ${command.cooldown} seconds\n\n`;
      }

      helpMessage += `*Category:* ${command.category || "uncategorized"}`;

      return terra.reply(msg, helpMessage);
    }

    // Get emoji for each category
    function getCategoryEmoji(category) {
      const categoryEmojis = {
        general: "🔧",
        media: "🎬",
        fun: "🎮",
        utility: "🛠️",
        admin: "⚙️",
        owner: "👑",
        uncategorized: "📝",
        sticker: "🖼️",
        group: "👥",
        download: "📥",
        info: "ℹ️",
        game: "🎲",
      };

      return categoryEmojis[category?.toLowerCase()] || "📌";
    }
  },
};
