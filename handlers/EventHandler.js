const fs = require("fs-extra");
const path = require("path");
const EventEmitter = require("events");

class EventHandler extends EventEmitter {
  constructor(terra) {
    super();
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: "EventHandler" });
    this.events = new Map();
  }

  /**
   * Load events from the events directory
   * @returns {Promise<number>} Number of events loaded
   */
  async loadEvents() {
    try {
      // Reset events map
      this.events.clear();

      const eventsDir = path.join(process.cwd(), "events");

      // Ensure events directory exists
      await fs.ensureDir(eventsDir);

      // Check if directory is empty
      const files = await fs.readdir(eventsDir);
      if (files.length === 0) {
        this.logger.warn("Events directory is empty. Please add event files.");
      }

      // Load events
      const eventFiles = (await fs.readdir(eventsDir)).filter((file) =>
        file.endsWith(".js")
      );

      for (const file of eventFiles) {
        try {
          // Clear cache to reload if changed
          delete require.cache[require.resolve(path.join(eventsDir, file))];

          // Import event
          const event = require(path.join(eventsDir, file));

          // Validate event structure
          if (!event.name || !event.execute) {
            this.logger.warn(`Event in ${file} is missing required properties`);
            continue;
          }

          // Register event
          this.events.set(event.name.toLowerCase(), event);

          this.logger.debug(`Loaded event: ${event.name}`);
        } catch (error) {
          this.logger.error(`Error loading event ${file}: ${error.message}`);
        }
      }

      this.logger.info(`Loaded ${this.events.size} events`);
      return this.events.size;
    } catch (error) {
      this.logger.error(`Error loading events: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Handle an event
   * @param {string} eventName Name of the event
   * @param {...any} args Arguments to pass to the event handler
   */
  async handleEvent(eventName, ...args) {
    try {
      // Get event handler
      const event = this.events.get(eventName.toLowerCase());
      // Remove console.log(event) - this just clutters logs

      if (event) {
        // Execute the event handler
        await event.execute(this.terra, ...args);
      } else {
        // Add better debugging for missing events
        this.logger.debug(`No handler found for event: ${eventName}`);
      }

      // Also emit the event for any listeners
      this.emit(eventName, ...args);
    } catch (error) {
      this.logger.error(`Error executing event ${eventName}: ${error.message}`);
    }
  }
}

module.exports = EventHandler;
