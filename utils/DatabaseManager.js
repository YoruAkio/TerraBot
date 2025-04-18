const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');

/**
 * Database for persistent data storage with auto-save functionality
 */
class Database extends EventEmitter {
  /**
   * Create a new database instance
   * @param {Object} options Database options
   * @param {string} options.name Name of the database (used for logging)
   * @param {string} options.filePath Path to the database file
   * @param {Object} options.logger Logger instance
   * @param {number} options.autoSaveInterval Auto-save interval in ms (default: 20000)
   */
  constructor(options) {
    super();
    this.name = options.name || 'Database';
    this.filePath = options.filePath;
    this.logger = options.logger || console;
    this.autoSaveInterval = options.autoSaveInterval || 20000;
    this.data = new Map();
    this.hasChanges = false;
    this.autoSaveTimer = null;
    this.isLoaded = false;

    // Graceful shutdown: save data on process exit/signals
    const saveOnExit = async () => {
      try {
        if (this.hasChanges) {
          await this.save();
        }
      } catch (err) {
        this.logger.error(`Error saving database on exit: ${err}`);
      }
    };

    process.on('SIGINT', async () => {
      await saveOnExit();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await saveOnExit();
      process.exit(0);
    });
    process.on('exit', async () => {
      await saveOnExit();
    });
  }

  /**
   * Initialize the database
   */
  async initialize() {
    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.filePath));
      
      // Load existing data
      await this.load();
      
      // Start auto-save timer
      this.startAutoSave();
      
      this.logger.info(`Database ${this.name} initialized with ${this.data.size} records`);
      return true;
    } catch (error) {
      this.logger.error(`Error initializing database ${this.name}: ${error}`);
      return false;
    }
  }

  /**
   * Start the auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.hasChanges) {
        await this.save();
        this.hasChanges = false;
      }
    }, this.autoSaveInterval);
    
    // Make sure timer doesn't prevent Node from exiting
    this.autoSaveTimer.unref();
  }

  /**
   * Stop the auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Load data from file
   */
  async load() {
    try {
      if (await fs.pathExists(this.filePath)) {
        const rawData = await fs.readJson(this.filePath);
        
        // Convert object to Map
        this.data.clear();
        for (const [key, value] of Object.entries(rawData)) {
          this.data.set(key, value);
        }
        
        this.isLoaded = true;
        this.emit('loaded', this.data.size);
        this.logger.info(`Loaded ${this.data.size} records from ${this.name}`);
      } else {
        this.isLoaded = true;
        this.emit('loaded', 0);
      }
      return true;
    } catch (error) {
      this.logger.error(`Error loading database ${this.name}: ` + error);
      return false;
    }
  }

  /**
   * Save data to file
   */
  async save() {
    try {
      // Convert Map to object for JSON serialization
      const dataObj = Object.fromEntries(this.data);
      
      await fs.writeJson(this.filePath, dataObj, { spaces: 2 });
      this.emit('saved');
      this.logger.debug(`Saved ${this.data.size} records to ${this.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Error saving database ${this.name}: ${error}`);
      return false;
    }
  }

  /**
   * Get a value from the database
   * @param {string} key The key
   * @param {*} defaultValue Default value if key doesn't exist
   */
  get(key, defaultValue = null) {
    return this.data.has(key) ? this.data.get(key) : defaultValue;
  }

  /**
   * Check if key exists in database
   * @param {string} key The key
   */
  has(key) {
    return this.data.has(key);
  }

  /**
   * Set a value in the database
   * @param {string} key The key
   * @param {*} value The value
   */
  set(key, value) {
    this.data.set(key, value);
    this.hasChanges = true;
    this.emit('updated', key, value);
    return value;
  }

  /**
   * Delete a key from the database
   * @param {string} key The key
   */
  delete(key) {
    const result = this.data.delete(key);
    if (result) {
      this.hasChanges = true;
      this.emit('deleted', key);
    }
    return result;
  }

  /**
   * Get all data as an array of [key, value] pairs
   */
  entries() {
    return Array.from(this.data.entries());
  }

  /**
   * Get all values as an array
   */
  values() {
    return Array.from(this.data.values());
  }

  /**
   * Get all keys as an array
   */
  keys() {
    return Array.from(this.data.keys());
  }

  /**
   * Get number of records in database
   */
  get size() {
    return this.data.size;
  }

  /**
   * Clear the database
   */
  clear() {
    this.data.clear();
    this.hasChanges = true;
    this.emit('cleared');
  }
}

module.exports = Database;