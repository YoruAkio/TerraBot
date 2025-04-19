const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  getContentType,
  downloadMediaMessage,
  delay,
  isJidGroup,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const NodeCache = require("node-cache");
const axios = require("axios");

const CommandHandler = require("../handlers/CommandHandler");
const EventHandler = require("../handlers/EventHandler");
const StoreManager = require("../utils/StoreManager");
const MessageUtils = require("../utils/MessageUtils");
const ReactionHandler = require("../handlers/ReactionHandler");
const ContactManager = require("../utils/ContactManager");
const GroupManager = require("../utils/GroupManager");
const QueueManager = require("../utils/QueueManager");
const LevelManager = require("../utils/LevelManager");

class Terra {
  constructor(config) {
    // Set default config values if not provided
    this.config = {
      prefix: "!",
      ownerNumber: "",
      statusMessage: "TerraBot Active",
      sessionPath: "./sessions",
      logLevel: "info",
      maxReconnects: 5,
      reconnectInterval: 3000,
      enableReadReceipts: true,
      enableTypingIndicator: true,
      typingTimeout: 3000,
      connectionTimeout: 60000,
      qrTimeout: 60000,
      msgRetryCounterCache: new NodeCache(),
      ...config,
    };

    // Initialize base logger with options
    this.logger = {
      // Base logger methods that use config.name as default module name
      fatal: (message) =>
        this._logWithFormat(
          "fatal",
          message,
          "💀",
          "\x1b[31m",
          this.config.name || "TerraBot"
        ),
      error: (message) =>
        this._logWithFormat(
          "error",
          message,
          "❌",
          "\x1b[31m",
          this.config.name || "TerraBot"
        ),
      warn: (message) =>
        this._logWithFormat(
          "warn",
          message,
          "⚠️",
          "\x1b[33m",
          this.config.name || "TerraBot"
        ),
      info: (message) =>
        this._logWithFormat(
          "info",
          message,
          "ℹ️",
          "\x1b[36m",
          this.config.name || "TerraBot"
        ),
      debug: (message) =>
        this._logWithFormat(
          "debug",
          message,
          "🔍",
          "\x1b[32m",
          this.config.name || "TerraBot"
        ),
      trace: (message) =>
        this._logWithFormat(
          "trace",
          message,
          "🔬",
          "\x1b[90m",
          this.config.name || "TerraBot"
        ),

      // Support for creating child loggers
      child: (bindings) => {
        const childLogger = { ...this.logger };
        const moduleName = bindings.name || this.config.name || "TerraBot";

        // Override the logging methods for the child logger
        childLogger.fatal = (message) =>
          this._logWithFormat("fatal", message, "💀", "\x1b[31m", moduleName);
        childLogger.error = (message) =>
          this._logWithFormat("error", message, "❌", "\x1b[31m", moduleName);
        childLogger.warn = (message) =>
          this._logWithFormat("warn", message, "⚠️", "\x1b[33m", moduleName);
        childLogger.info = (message) =>
          this._logWithFormat("info", message, "ℹ️", "\x1b[36m", moduleName);
        childLogger.debug = (message) =>
          this._logWithFormat("debug", message, "🔍", "\x1b[32m", moduleName);
        childLogger.trace = (message) =>
          this._logWithFormat("trace", message, "🔬", "\x1b[90m", moduleName);

        return childLogger;
      },
    };

    // Helper method to format log messages consistently
    this._logWithFormat = (level, message, emoji, color, moduleName = "") => {
      // Format timestamp
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const timestamp = `${hours}:${minutes} ${day}-${month}`;
    
      // Format log level - right aligned in fixed width (7 chars)
      const levelText = level.toUpperCase().padStart(7);
    
      // Format message content - handle both direct error objects and error as second parameter
      let formattedMessage = "";
      
      // Check if first argument is a string and we have additional arguments
      if (typeof message === "string" && arguments.length > 5) {
        // We have additional arguments after the standard ones
        formattedMessage = message;
        
        // Process additional arguments (typically errors)
        for (let i = 5; i < arguments.length; i++) {
          const arg = arguments[i];
          if (arg instanceof Error) {
            formattedMessage += `${arg.message}\n${arg.stack || ''}`;
          } else if (typeof arg === "object") {
            formattedMessage += JSON.stringify(arg, null, 2);
          } else {
            formattedMessage += String(arg);
          }
        }
      } 
      // Handle single argument cases (original behavior)
      else if (typeof message === "object") {
        if (message instanceof Error) {
          formattedMessage = `${message.message}\n${message.stack || ''}`;
        } else {
          // Extract useful properties and format as key-value pairs
          const { name, ...details } = message;
          if (Object.keys(details).length > 0) {
            const detailsStr = Object.entries(details)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(", ");
            formattedMessage = detailsStr;
          } else {
            formattedMessage = "";
          }
        }
      } else {
        formattedMessage = message;
      }
    
      // Create a consistent module display with better alignment
      let moduleText;
      if (moduleName) {
        const moduleColor = this._getModuleColor(moduleName);
        const moduleDisplay =
          moduleName.length > 15
            ? moduleName.substring(0, 12) + "..."
            : moduleName.padEnd(15);
        moduleText = `${moduleColor}[${moduleDisplay}]${"\x1b[0m"} `;
      } else {
        moduleText = " ".repeat(17); // +2 for brackets
      }
    
      // Output the formatted log message with consistent alignment
      console.log(
        `${color}${timestamp} ${levelText}\x1b[0m | ${moduleText}${formattedMessage}`
      );
    };

    // Maintain the module color mapping
    this._getModuleColor = (moduleName) => {
      const moduleColors = {
        TerraBot: "\x1b[35m", // Purple
        CommandHandler: "\x1b[32m", // Green
        ContactManager: "\x1b[36m", // Cyan
        GroupManager: "\x1b[33m", // Yellow
        LevelManager: "\x1b[34m", // Blue
        MessageUtils: "\x1b[36m", // Cyan
        StoreManager: "\x1b[33m", // Yellow
        EventHandler: "\x1b[35m", // Purple
        default: "\x1b[37m", // White
      };
      return moduleColors[moduleName] || moduleColors.default;
    };

    // Initialize state variables
    this.socket = null;
    this.isConnected = false;
    this.reconnectCount = 0;
    this.qrCodeUrl = null;
    this.startupTime = Date.now();
    this.messageCount = { sent: 0, received: 0 };
    this.isReconnecting = false;
    this.authState = null;

    // Handle graceful shutdown
    this._setupShutdownHandlers();

    // Create directories if they don't exist
    this._createDirectories();

    // Initialize utility managers
    this.storeManager = new StoreManager(this);
    this.contactManager = new ContactManager(this);
    this.groupManager = new GroupManager(this);
    this.queueManager = new QueueManager(this);
    this.levelManager = new LevelManager(this);

    // Initialize handlers
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.messageUtils = new MessageUtils(this);
    this.reactionHandler = new ReactionHandler(this);

    this.logger.info("TerraBot initialized");
  }

  _createDirectories() {
    // Create sessions directory
    fs.ensureDirSync(this.config.sessionPath);

    // Create temp directory
    fs.ensureDirSync(path.join(process.cwd(), "temp"));

    // Create directories for commands and events if not exist
    fs.ensureDirSync(path.join(process.cwd(), "commands"));
    fs.ensureDirSync(path.join(process.cwd(), "events"));
  }

  _setupShutdownHandlers() {
    // Capture SIGINT and SIGTERM for graceful shutdown
    process.once("SIGINT", async () => {
      this.logger.info("Shutting down TerraBot...");
      await this.levelManager.saveData();
      await this.stop(false); // Don't log out, just disconnect
      process.exit(0);
    });

    process.once("SIGTERM", async () => {
      this.logger.info("Shutting down TerraBot...");
      await this.levelManager.saveData();
      await this.stop(false); // Don't log out, just disconnect
      process.exit(0);
    });
  }

  /**
   * Start the bot and all its services
   */
  async start() {
    try {
      this.logger.info("Starting TerraBot...");

      // Initialize store manager
      await this.storeManager.initialize();

      // Initialize level manager
      await this.levelManager.initialize();

      // Connect to WhatsApp
      this.logger.info("Connecting to WhatsApp...");
      await this.connect();

      // Load commands and events
      await this.commandHandler.loadCommands();
      await this.eventHandler.loadEvents();

      // Force command handler and event handler registration
      if (this.commandHandler.commands.size === 0) {
        this.logger.warn("No commands loaded! Creating example commands...");
        await this.commandHandler._createExampleCommands();
        await this.commandHandler.loadCommands();
      }

      this.logger.info("TerraBot started successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to start TerraBot:" + error);
      throw error;
    }
  }

  async connect() {
    try {
      if (this.isReconnecting) {
        this.logger.info(
          "Already attempting to reconnect, skipping duplicate request"
        );
        return;
      }

      this.isReconnecting = true;
      this.logger.info("Connecting to WhatsApp...");

      // Fetch the latest version of Baileys
      const { version } = await fetchLatestBaileysVersion();
      this.logger.debug(`Using Baileys version ${version.join(".")}`);

      // Ensure session directory exists
      fs.ensureDirSync(this.config.sessionPath);

      // Get auth state
      const { state, saveCreds } = await useMultiFileAuthState(
        this.config.sessionPath
      );

      // Save auth state for later use
      this.authState = { state, saveCreds };

      // Create a signal key store with caching
      const signalKeyStore = makeCacheableSignalKeyStore(
        state.keys,
        this.logger
      );

      // Create socket with more options for better handling
      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: signalKeyStore,
        },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        markOnlineOnConnect: true,
        connectTimeoutMs: this.config.connectionTimeout,
        qrTimeout: this.config.qrTimeout,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 10000,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        browser: ["TerraBot", "Chrome", "103.0.5060.114"],
        getMessage: async (key) => {
          return this.storeManager.getMessage(key);
        },
        msgRetryCounterCache: this.config.msgRetryCounterCache,
        retryRequestDelayMs: 2000,
      });

      // Set up connection events with better error handling
      this.socket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR Code for terminal
          qrcode.generate(qr, { small: true });

          // Generate QR code URLs (multiple options for more reliability)
          this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            qr
          )}`;
          const qrServerUrl = `https://qrcode.jiashunw.com/api/qr?text=${encodeURIComponent(
            qr
          )}`;

          this.logger.info("\n📱 Scan the QR code using WhatsApp app:");
          this.logger.info(this.qrCodeUrl);
          this.logger.info(`Alternative URL: ${qrServerUrl}`);

          // Emit QR code event for web interfaces
          this.eventHandler.emit("qr.code", {
            url: this.qrCodeUrl,
            alternative: qrServerUrl,
            raw: qr,
          });
        }

        if (connection === "close") {
          this.isConnected = false;
          this.logger.info("Connection closed");

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          if (
            shouldReconnect &&
            this.reconnectCount < this.config.maxReconnects
          ) {
            this.reconnectCount++;
            this.logger.warn(
              `Connection closed, reconnecting (${this.reconnectCount})...`
            );

            // Use exponential backoff for reconnect timing
            const delay =
              this.config.reconnectInterval *
              Math.pow(1.5, this.reconnectCount - 1);

            this.isReconnecting = false; // Reset reconnect flag
            setTimeout(() => this.connect(), delay);
          } else if (statusCode === DisconnectReason.loggedOut) {
            this.logger.warn(
              "Logged out, please scan the QR code to reconnect."
            );
            // Clear the session files to force new QR code scan
            await fs.emptyDir(this.config.sessionPath);
            await this.levelManager.saveData();
            this.isReconnecting = false;
            this.reconnectCount = 0;
            setTimeout(() => this.connect(), 1000);
          } else {
            this.logger.error(
              "Connection closed permanently after max retries"
            );
            this.isReconnecting = false;
            this.eventHandler.emit("connection.failed");
          }
        }

        if (connection === "open") {
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectCount = 0;
          this.logger.info("✅ Connection established successfully!");

          // Wait a moment to ensure connection is stable
          await delay(1000);

          try {
            // Get user information with retries
            let attempts = 0;
            let userInfo = null;

            while (attempts < 3 && !userInfo?.id) {
              userInfo = await this._getUserInfo();
              if (!userInfo?.id) {
                this.logger.warn(
                  `Failed to get user info (attempt ${
                    attempts + 1
                  }/3), retrying...`
                );
                await delay(1000);
              }
              attempts++;
            }

            if (userInfo?.id) {
              const userId = userInfo.id.replace(/:.+@/g, "@").split("@")[0];
              this.logger.info(
                `Logged in as ${userInfo.name || "Unknown"} (${userId})`
              );

              // Save user info
              this.user = userInfo;

              // Set status
              try {
                await this.socket.updateProfileStatus(
                  this.config.statusMessage
                );
                this.logger.info(`Status set to: ${this.config.statusMessage}`);
              } catch (e) {
                this.logger.warn("Failed to update status:", e.message);
              }
            } else {
              this.logger.warn(
                "Could not retrieve user info, continuing anyway"
              );
            }

            // Emit open connection event
            this.eventHandler.emit(
              "connection.open",
              userInfo || { id: null, name: "Unknown" }
            );
          } catch (error) {
            this.logger.error("Error during post-connection setup:" + error);
          }
        }
      });

      // Save credentials when updated
      this.socket.ev.on("creds.update", async () => {
        try {
          await this.authState.saveCreds();
          this.logger.debug("Credentials updated and saved");
        } catch (error) {
          this.logger.error("Error saving credentials:" + error);
        }
      });

      // Setup message handler
      this.socket.ev.on("messages.upsert", async (m) => {
        if (m.type !== "notify") return;
        const sender = m.messages[0].key.remoteJid;

        if (!isJidGroup(sender)) {
          // Handle private messages
          this.logger.info(`Received message from ${sender}`);
        }

        try {
          // Process each message
          for (const msg of m.messages) {
            // Count received messages for stats
            this.messageCount.received++;

            try {
              // Debugging
              // this.logger.debug(`Received message: ${JSON.stringify(msg.key)}`);

              // Store message
              await this.storeManager.saveMessage(msg);

              // Log message
              // if (this.config.enableMessageLogging) {
              //   await this.messageLogger.logMessage(msg);
              // }

              // Process message read receipts if enabled
              if (this.config.enableReadReceipts && !msg.key.fromMe) {
                await this.socket.readMessages([msg.key]);
              }

              // Emit the message event
              await this.eventHandler.handleEvent("message", msg);
            } catch (msgError) {
              this.logger.error("Error processing message:", msgError);
            }
          }
        } catch (error) {
          this.logger.error("Error processing message batch:" + error);
        }
      });

      // Handle reactions
      this.socket.ev.on("messages.reaction", async (reactions) => {
        try {
          await this.reactionHandler.handleReactions(reactions);
        } catch (error) {
          this.logger.error("Error handling reactions:" + error);
        }
      });

      // Handle group events
      this.socket.ev.on("group-participants.update", async (update) => {
        try {
          await this.eventHandler.handleEvent(
            "group-participants.update",
            update
          );
        } catch (error) {
          this.logger.error("Error handling group participants update:" + error);
        }
      });

      // Handle group settings updates
      this.socket.ev.on("groups.update", async (updates) => {
        try {
          await this.eventHandler.handleEvent("groups.update", updates);
        } catch (error) {
          this.logger.error("Error handling group update:" + error);
        }
      });

      // Handle message status updates
      this.socket.ev.on("message-receipt.update", async (updates) => {
        try {
          await this.eventHandler.handleEvent("message.receipt", updates);
        } catch (error) {
          this.logger.error("Error handling message receipt update:" + error);
        }
      });

      this.isReconnecting = false;
      return this.socket;
    } catch (error) {
      this.logger.error("Connection failed:" + error);
      this.isReconnecting = false;
      this.eventHandler.emit("connection.failed" + error);

      // Attempt to reconnect
      if (this.reconnectCount < this.config.maxReconnects) {
        this.reconnectCount++;
        const delay =
          this.config.reconnectInterval *
          Math.pow(1.5, this.reconnectCount - 1);
        this.logger.info(
          `Attempting to reconnect (${this.reconnectCount}) after ${delay}ms...`
        );
        setTimeout(() => this.connect(), delay);
      } else {
        this.logger.error("Max reconnection attempts reached");
      }
    }
  }

  /**
   * Get user information with improved error handling
   * @private
   * @returns {Object} User information
   */
  async _getUserInfo() {
    try {
      // Make sure we have a socket connection
      if (!this.socket) {
        return { id: null, name: "Unknown" };
      }

      // First try to get user from socket.authState
      if (this.socket.authState?.creds?.me?.id) {
        const id = this.socket.authState.creds.me.id;
        const name = this.socket.authState.creds.me.name || "Unknown";

        return {
          id,
          name,
          status: "",
        };
      }

      // Second approach: from socket.user
      if (this.socket.user?.id) {
        return {
          id: this.socket.user.id,
          name: this.socket.user.name || "Unknown",
          status: "",
        };
      }

      // Third approach: directly from authState
      if (this.authState?.state?.creds?.me?.id) {
        const id = this.authState.state.creds.me.id;
        const name = this.authState.state.creds.me.name || "Unknown";

        return {
          id,
          name,
          status: "",
        };
      }

      // Try getting from account details directly
      try {
        const phoneNumber = this.socket.authState?.creds?.me?.id?.split(":")[0];
        if (phoneNumber) {
          return {
            id: phoneNumber + "@s.whatsapp.net",
            name: "WhatsApp User",
            phoneNumber,
          };
        }
      } catch (e) {
        this.logger.debug("Could not extract phone number:", e.message);
      }

      // Fallback
      return { id: "unknown@s.whatsapp.net", name: "Unknown" };
    } catch (error) {
      this.logger.error("Error getting user info:" + error);
      return { id: null, name: "Unknown" };
    }
  }

  /**
   * Stop the bot
   * @param {boolean} logout Whether to log out (default: false)
   */
  async stop(logout = false) {
    try {
      this.logger.info("Stopping TerraBot...");

      // Save any pending data
      await this.storeManager.saveStore();

      if (this.socket) {
        if (logout) {
          // Log out if requested
          this.logger.warn("Logging out from WhatsApp...");
          await this.socket.logout();
          await this.levelManager.saveData();

          // Clear session
          await fs.emptyDir(this.config.sessionPath);
        } else {
          // Just close the connection without logging out
          await this.levelManager.saveData();
          this.logger.info("Disconnecting from WhatsApp...");
          try {
            await this.socket.end();
          } catch (e) {
            // Ignore errors when closing connection
          }
        }
      }

      this.socket = null;
      this.isConnected = false;

      this.logger.info("TerraBot stopped successfully");
      return true;
    } catch (error) {
      this.logger.error("Error stopping TerraBot:" + error);
      return false;
    }
  }

  /**
   * Restart the bot
   */
  async restart() {
    this.logger.info("Restarting TerraBot...");
    await this.stop(false);
    await this.start();
    this.logger.info("TerraBot restarted successfully");
  }

  /**
   * Send a message to a chat
   * @param {string} jid Chat JID
   * @param {string|object} content Message content
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendMessage(jid, content, options = {}) {
    if (!this.isConnected) {
      throw new Error("Bot is not connected");
    }

    try {
      // If content is a string, convert to text message object
      const message = typeof content === "string" ? { text: content } : content;

      // Use message queue to prevent rate limiting
      const result = await this.queueManager.addToQueue(async () => {
        // Add typing indicator if enabled and it's a text message
        if (this.config.enableTypingIndicator && message.text) {
          // Change from "composing" to "recording" to show microphone icon
          await this.socket.sendPresenceUpdate("recording", jid);
        
          // Simulate recording delay based on message length
          const recordingDelay = Math.min(
            this.config.typingTimeout,
            Math.max(500, message.text.length * 30)
          );
          await delay(recordingDelay);
        
          // Clear recording indicator
          await this.socket.sendPresenceUpdate("paused", jid);
        }

        const sent = await this.socket.sendMessage(jid, message, options);

        // Count sent messages for stats
        this.messageCount.sent++;

        return sent;
      });

      return result;
    } catch (error) {
      this.logger.error(`Error sending message to ${jid}: ${error}`);
      throw error;
    }
  }

  /**
   * Reply to a message
   * @param {object} msg Message to reply to
   * @param {string|object} content Reply content
   * @param {object} options Reply options
   * @returns {Promise<object>} Message info
   */
  async reply(msg, content, options = {}) {
    if (!msg?.key?.remoteJid) {
      throw new Error("Invalid message object");
    }

    // Merge options with quoted message
    const replyOptions = {
      ...options,
      quoted: msg,
    };

    return this.sendMessage(msg.key.remoteJid, content, replyOptions);
  }

  /**
   * Send an image
   * @param {string} jid Chat JID
   * @param {string|Buffer} image Image path or buffer
   * @param {string} caption Image caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendImage(jid, image, caption = "", options = {}) {
    return this.messageUtils.sendImage(jid, image, caption, options);
  }

  /**
   * Send a sticker
   * @param {string} jid Chat JID
   * @param {string|Buffer} sticker Sticker path or buffer
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendSticker(jid, sticker, options = {}) {
    return this.messageUtils.sendSticker(jid, sticker, options);
  }

  /**
   * Send a video
   * @param {string} jid Chat JID
   * @param {string|Buffer} video Video path or buffer
   * @param {string} caption Video caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendVideo(jid, video, caption = "", options = {}) {
    return this.messageUtils.sendVideo(jid, video, caption, options);
  }

  /**
   * Send a gif
   * @param {string} jid Chat JID
   * @param {string|Buffer} gif GIF path or buffer
   * @param {string} caption GIF caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendGIF(jid, buffer, caption, options) {
    return await this.socket.sendMessage(jid, {
      video: buffer,
      gifPlayback: true,
      caption: caption,
      ...options
    });
  }

  /**
   * Send an audio message
   * @param {string} jid Chat JID
   * @param {string|Buffer} audio Audio path or buffer
   * @param {boolean} ptt Is voice note
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendAudio(jid, audio, ptt = false, options = {}) {
    return this.messageUtils.sendAudio(jid, audio, ptt, options);
  }

  /**
   * Send a document
   * @param {string} jid Chat JID
   * @param {string|Buffer} document Document path or buffer
   * @param {string} filename Document filename
   * @param {string} caption Document caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendDocument(jid, document, filename, caption = "", options = {}) {
    return this.messageUtils.sendDocument(
      jid,
      document,
      filename,
      caption,
      options
    );
  }

  /**
   * Send a location
   * @param {string} jid Chat JID
   * @param {object} coordinates Coordinates {latitude, longitude}
   * @param {string} caption Location caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendLocation(jid, coordinates, caption = "", options = {}) {
    return this.messageUtils.sendLocation(jid, coordinates, caption, options);
  }

  /**
   * Send a contact
   * @param {string} jid Chat JID
   * @param {string|string[]|object|object[]} contacts Contact(s) to send
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendContact(jid, contacts, options = {}) {
    return this.messageUtils.sendContact(jid, contacts, options);
  }

  /**
   * Send a button message
   * @param {string} jid Chat JID
   * @param {string} content Button content
   * @param {array} buttons Array of buttons
   * @param {string} footer Footer text
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendButtons(jid, content, buttons, footer = "", options = {}) {
    return this.messageUtils.sendButtons(
      jid,
      content,
      buttons,
      footer,
      options
    );
  }

  /**
   * React to a message
   * @param {object} msg Message to react to
   * @param {string} emoji Emoji to react with
   * @returns {Promise<object>} Message info
   */
  async react(msg, emoji) {
    return this.messageUtils.react(msg, emoji);
  }

  /**
   * Download media from a message
   * @param {object} msg Message containing media
   * @returns {Promise<Buffer>} Media buffer
   */
  async downloadMedia(msg) {
    return this.messageUtils.downloadMedia(msg);
  }

  /**
   * Get bot statistics
   * @returns {object} Bot statistics
   */
  getStats() {
    const uptime = Date.now() - this.startupTime;

    return {
      uptime,
      formattedUptime: this._formatTime(uptime),
      messages: this.messageCount,
      isConnected: this.isConnected,
      reconnectCount: this.reconnectCount,
    };
  }

  /**
   * Get User Name from message
   * @param {object} msg WhatsApp message
   * @returns {string} User name or JID
   */
  async getUserName(msg) {
    try {
      // Check if pushName exists directly in the message object
      if (msg.pushName) {
        return msg.pushName;
      }

      // Get sender JID
      const sender = msg.key.participant || msg.key.remoteJid;

      // Return phone number part of the JID as fallback
      return sender.split("@")[0];
    } catch (error) {
      this.logger.error(`Error getting user name: ${error.message}`);
      return "Unknown User";
    }
  }

  /**
   * Get user phone number from jid
   * @param {string} jid JID of the user
   * @returns {string} Phone number
   */
  getUserPhoneNumber(jid) {
    // Extract the phone number from the JID
    const phoneNumber = jid.split("@")[0];
    return phoneNumber;
  }

  /**
   * Save current configuration to file
   * @returns {Promise<boolean>} Success status
   */
  async saveConfig() {
    try {
      const configPath = path.join(process.cwd(), "config.js");

      // Convert config object to string representation
      const configData = `module.exports = ${JSON.stringify(
        this.config,
        null,
        2
      ).replace(/"([^"]+)":/g, "$1:")};`;

      await fs.writeFile(configPath, configData);
      this.logger.info("Configuration saved successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to save configuration:" + error);
      return false;
    }
  }

  /**
   * Log a message with optional user context
   * @param {string} level Log level
   * @param {string} message Message to log
   * @param {object} [user] User information
   * @param {object} [extra] Additional context
   */
  logWithContext(level, message, user = null, extra = {}) {
    if (!this.logger[level]) {
      level = "info";
    }

    let userInfo = "";
    if (user) {
      if (typeof user === "string") {
        userInfo = `[User: ${user}] `;
      } else if (user.name) {
        userInfo = `[User: ${user.name}] `;
      } else if (user.key?.remoteJid) {
        userInfo = `[User: ${user.key.remoteJid.split("@")[0]}] `;
      }
    }

    const extraInfo =
      Object.keys(extra).length > 0
        ? ` [${Object.entries(extra)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}]`
        : "";

    this.logger[level](`${userInfo}${message}${extraInfo}`);
  }

  /**
   * Check if the user is an admin in a group
   * @param {string} groupId Group ID
   * @param {string} userId User ID
   * @returns {boolean} True if user is admin, false otherwise
   */
  async isAdmin(groupId, userId) {
    try {
      const groupMetadata = await this.groupManager.getGroupMetadata(groupId);
      const participants = groupMetadata.participants || [];

      // Check if the user is an admin
      return participants.some(
        (participant) =>
          participant.id === userId && participant.admin !== undefined
      );
    } catch (error) {
      this.logger.error("Error checking admin status:" + error);
      return false;
    }
  }

  /**
   * Check if the user is a owner of the bot
   * @param {string} userId User ID
   * @returns {boolean} True if user is owner, false otherwise
   */
  isOwner(userId) {
    return this.config.ownerNumber === userId;
  }

  /**
   * Format time in ms to human-readable format
   * @private
   * @param {number} ms Time in milliseconds
   * @returns {string} Formatted time
   */
  _formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  }
}

module.exports = Terra;
