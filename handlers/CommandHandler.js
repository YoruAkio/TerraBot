const fs = require("fs-extra");
const path = require("path");

class CommandHandler {
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: "CommandHandler" });
    this.commands = new Map();
    this.aliases = new Map(); // Separate map for aliases
    this.cooldowns = new Map();
    this.categories = new Map();
    this.commandsDir = path.join(process.cwd(), "commands");
  }

  /**
   * Load commands from commands directory and its subdirectories
   * @returns {Promise<number>} Number of commands loaded
   */
  async loadCommands() {
    try {
      // Reset commands map
      this.commands.clear();
      this.aliases.clear();
      this.categories.clear();

      // Ensure commands directory exists
      await fs.ensureDir(this.commandsDir);

      // Load commands from root directory and categorized folders
      await this._loadCommandsFromDirectory(this.commandsDir);


      // Get unique command count (excluding aliases)
      const uniqueCommands = new Set();
      for (const cmd of this.commands.values()) {
        uniqueCommands.add(cmd.name);
      }

      // Log command names by category for better debugging
      const categories = this.getAllCategories();
      for (const category of categories) {
        const commands = this.getCommandsByCategory(
          category.name.toLowerCase()
        );
        const commandNames = commands.map((c) => c.name).join(", ");
        this.logger.debug(`Category ${category.name}: ${commandNames}`);
      }

      this.logger.info(
        `Loaded ${uniqueCommands.size} unique commands (${this.commands.size} including aliases) in ${this.categories.size} categories`
      );
      return uniqueCommands.size;
    } catch (error) {
      this.logger.error("Error loading commands:", error);
      return 0;
    }
  }

  /**
   * Load commands from a directory and its subdirectories
   * @private
   * @param {string} dir Directory to load commands from
   * @param {string} category Category name (derived from directory name)
   */
  async _loadCommandsFromDirectory(dir, category = null) {
    try {
      // Read all items in the directory
      const items = await fs.readdir(dir);

      // Process each item
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          // It's a subdirectory - load commands from it with category name from dir
          const subCategory = item.toLowerCase();
          await this._loadCommandsFromDirectory(itemPath, subCategory);

          // Register category
          if (!this.categories.has(subCategory)) {
            this.categories.set(subCategory, {
              name: this._formatCategoryName(subCategory),
              count: 0,
              path: itemPath,
            });
          }
        } else if (stats.isFile() && item.endsWith(".js")) {
          // It's a command file
          await this._loadCommandFile(itemPath, category);
        }
      }
    } catch (error) {
      this.logger.error(`Error loading commands from directory ${dir}:`, error);
    }
  }

  /**
   * Load a single command file
   * @private
   * @param {string} filePath Path to command file
   * @param {string} category Category from directory structure
   */
  async _loadCommandFile(filePath, category = null) {
    try {
      // Clear cache to reload if changed
      delete require.cache[require.resolve(filePath)];

      // Import command
      const command = require(filePath);

      // Validate command structure
      if (!command.name || !command.execute) {
        this.logger.warn(
          `Command in ${filePath} is missing required properties`
        );
        return;
      }

      // Set category from directory if not explicitly defined
      if (!command.category && category) {
        command.category = category;
      }

      // Use 'general' as default category if none specified
      if (!command.category) {
        command.category = "general";
      }

      // AUTO-SET PERMISSIONS BASED ON FOLDER
      // If command is in owner folder, set ownerOnly to true automatically
      if (
        command.category === "owner" &&
        !command.hasOwnProperty("ownerOnly")
      ) {
        command.ownerOnly = true;
      }

      // Register command
      this.commands.set(command.name.toLowerCase(), command);

      // Register aliases in a separate map
      if (command.aliases && Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          if (typeof alias === "string" && alias.trim()) {
            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
          }
        }
      }

      // Update category count
      if (!this.categories.has(command.category)) {
        this.categories.set(command.category, {
          name: this._formatCategoryName(command.category),
          count: 1,
          path: path.dirname(filePath),
        });
      } else {
        const categoryInfo = this.categories.get(command.category);
        categoryInfo.count++;
        this.categories.set(command.category, categoryInfo);
      }

      this.logger.debug(
        `Loaded command: ${command.name} (${command.category})`
      );
    } catch (error) {
      this.logger.error(`Error loading command file ${filePath}:`, error);
    }
  }

  /**
   * Format category name for display
   * @private
   * @param {string} category Category name to format
   * @returns {string} Formatted category name
   */
  _formatCategoryName(category) {
    return category
      .split(/[_-\s]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Get context information for command execution
   * @private
   * @param {object} msg WhatsApp message
   * @param {object} command Command to execute
   * @returns {Promise<object>} Context object
   */
  async _getCommandContext(msg, command) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = msg.key.remoteJid.endsWith("@g.us");
    let groupMetadata = null;

    // Get group metadata if in a group
    if (isGroup) {
      try {
        groupMetadata = await this.terra.groupManager.getGroupMetadata(
          msg.key.remoteJid
        );
      } catch (error) {
        this.logger.error("Error getting group metadata:", error);
      }
    }

    // Return complete context object
    return {
      isGroup,
      groupMetadata,
      isOwner: this.isOwner(sender),
      isAdmin: isGroup ? this.isAdmin(sender, groupMetadata) : false,
      sender,
      name: msg.pushName || sender.split("@")[0],
      chatJid: msg.key.remoteJid,
      isPrivate: !isGroup,
      command,
    };
  }

  /**
   * Handle incoming message for commands
   * @param {object} msg WhatsApp message
   */
  async handleMessage(msg) {
    try {
      // Skip processing if message is from bot itself or invalid
      if (msg.key.fromMe || !msg.message) return;

      // Get message content
      const content = this._extractMessageContent(msg);
      if (!content) return;

      // Check if message starts with prefix
      const prefix = this.terra.config.prefix;
      if (!content.startsWith(prefix)) return;

      // Extract command name and arguments
      const args = content.slice(prefix.length).trim().split(/\s+/);
      const inputCommandName = args.shift()?.toLowerCase();

      if (!inputCommandName) return;

      // Get command from name or alias
      let command = this.getCommand(inputCommandName);
      if (!command) return;

      // Check cooldown
      if (command.cooldown) {
        const { result, timeLeft } = this._checkCooldown(
          msg.key.remoteJid,
          command
        );
        if (!result) {
          return this.terra.reply(
            msg,
            `⏳ Please wait ${timeLeft.toFixed(
              1
            )} more seconds before using this command again.`
          );
        }
      }

      // Get context information
      const context = await this._getCommandContext(msg, command);

      // Check command permissions
      const permissionCheck = this._checkCommandPermissions(command, context);
      if (permissionCheck.error) {
        return this.terra.reply(msg, permissionCheck.error);
      }

      // Log command usage
      this.logger.info(
        `${context.sender} used command: ${command.name} ${args.join(" ")}`
      );

      // Execute command with proper parameters
      try {
        if (command.execute.length <= 3) {
          // Command doesn't expect context parameter
          await command.execute(this.terra, msg, args);
        } else {
          // Command expects context parameter
          await command.execute(this.terra, msg, args, context);
        }
      } catch (execError) {
        this.logger.error("Error executing command:", execError);
        await this.terra.reply(
          msg,
          `❌ Error executing command: ${execError.message}`
        );
      }
    } catch (error) {
      this.logger.error("Error handling command:", error);
      // Only reply if we can extract a meaningful error message
      if (error.message) {
        await this.terra.reply(
          msg,
          `❌ Error processing command: ${error.message}`
        );
      }
    }
  }

  /**
   * Check if a user is the bot owner
   * @param {string} jid JID of the user to check
   * @returns {boolean} Whether the user is the owner
   */
  isOwner(jid) {
    // Extract the user part (remove any @s.whatsapp.net, etc.)
    const cleanJid = jid.split("@")[0];
    const cleanOwner = this.terra.config.ownerNumber.split("@")[0];

    return cleanJid === cleanOwner || jid === this.terra.config.ownerNumber;
  }

  /**
   * Check if a user is an admin in a group
   * @param {string} jid JID of the user to check
   * @param {Object} groupMetadata Group metadata
   * @returns {boolean} Whether the user is an admin
   */
  isAdmin(jid, groupMetadata) {
    if (!groupMetadata || !groupMetadata.participants) return false;

    // Check if the user is in the participants list and has admin privileges
    return groupMetadata.participants.some(
      (p) => p.id === jid && ["admin", "superadmin"].includes(p.admin)
    );
  }

  /**
   * Check cooldown for a command
   * @private
   * @param {string} jid User or group JID
   * @param {object} command Command object
   * @returns {object} Result and time left
   */
  _checkCooldown(jid, command) {
    const cooldownAmount = (command.cooldown || 3) * 1000;
    const now = Date.now();

    // Create cooldown entry if it doesn't exist
    if (!this.cooldowns.has(command.name)) {
      this.cooldowns.set(command.name, new Map());
    }

    const timestamps = this.cooldowns.get(command.name);

    if (timestamps.has(jid)) {
      const expirationTime = timestamps.get(jid) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return { result: false, timeLeft };
      }
    }

    // Set cooldown
    timestamps.set(jid, now);
    setTimeout(() => timestamps.delete(jid), cooldownAmount);

    return { result: true, timeLeft: 0 };
  }

  /**
   * Extract message content from message object
   * @private
   * @param {object} msg WhatsApp message
   * @returns {string|null} Message content
   */
  _extractMessageContent(msg) {
    if (!msg.message) return null;

    if (msg.message.conversation) {
      return msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage?.caption) {
      return msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage?.caption) {
      return msg.message.videoMessage.caption;
    }

    return null;
  }

  /**
   * Get all commands in a category
   * @param {string} category Category name
   * @returns {Array} Array of commands in the category
   */
  getCommandsByCategory(category) {
    const categoryCommands = [];
    const processed = new Set(); // To avoid duplicates from aliases

    for (const [name, cmd] of this.commands.entries()) {
      if (cmd.category === category && !processed.has(cmd.name)) {
        categoryCommands.push(cmd);
        processed.add(cmd.name);
      }
    }

    return categoryCommands;
  }

  /**
   * Get all available categories
   * @returns {Array} Array of category objects
   */
  getAllCategories() {
    return Array.from(this.categories.values());
  }

  /**
   * Get command by name or alias
   * @param {string} nameOrAlias Command name or alias
   * @returns {Object|null} Command object or null if not found
   */
  getCommand(nameOrAlias) {
    const lowerName = nameOrAlias.toLowerCase();

    // Check if it's a direct command
    if (this.commands.has(lowerName)) {
      return this.commands.get(lowerName);
    }

    // Check if it's an alias
    if (this.aliases.has(lowerName)) {
      const commandName = this.aliases.get(lowerName);
      return this.commands.get(commandName);
    }

    return null;
  }

  /**
   * Check command permissions
   * @private
   * @param {object} command Command to check
   * @param {object} context Command context
   * @returns {object} Result object with error property if permission check fails
   */
  _checkCommandPermissions(command, context) {
    const { isGroup, isOwner, isAdmin } = context;

    // Check if command is group-only
    if (command.groupOnly && !isGroup) {
      return { error: "❌ This command can only be used in groups." };
    }

    // Check if command is private-only
    if (command.privateOnly && isGroup) {
      return { error: "❌ This command can only be used in private chats." };
    }

    // Check if command is owner-only
    if (command.ownerOnly && !isOwner) {
      return { error: "❌ This command can only be used by the bot owner." };
    }

    // Check if command requires admin (for groups)
    if (command.adminOnly && isGroup && !isAdmin) {
      return { error: "❌ This command can only be used by group admins." };
    }

    return { error: null };
  }
}

module.exports = CommandHandler;
