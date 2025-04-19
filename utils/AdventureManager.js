const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

/**
 * Adventure system manager for RPG-style gameplay features
 */
class AdventureManager {
  /**
   * Create a new AdventureManager instance
   * @param {Object} terra - The Terra bot instance
   */
  constructor(terra) {
    this.terra = terra;
    this.logger = terra.logger.child({ name: "AdventureManager" });
    this.isInitialized = false;

    // Game data storage
    this.items = new Map();
    this.monsters = new Map();
    this.locations = new Map();
    this.quests = new Map();

    // Cooldown tracking (in-memory)
    this.cooldowns = new Map();

    // Constants
    this.COOLDOWNS = {
      HUNT: 2 * 60 * 1000, // 2 minutes
      TRAIN: 30 * 60 * 1000, // 30 minutes
      DAILY: 24 * 60 * 60 * 1000, // 24 hours
      QUEST: 60 * 60 * 1000, // 1 hour
    };

    // Data directories - now we'll only store game content here, not user data
    this.dataDir = path.join(process.cwd(), "data", "adventure");
    this.itemsFile = path.join(this.dataDir, "items.json");
    this.monstersFile = path.join(this.dataDir, "monsters.json");
    this.locationsFile = path.join(this.dataDir, "locations.json");
    this.questsFile = path.join(this.dataDir, "quests.json");
  }

  /**
   * Initialize the adventure manager
   */
  async initialize() {
    try {
      this.logger.info("Initializing AdventureManager...");

      // Create data directories if they don't exist
      await fs.ensureDir(this.dataDir);

      // Load game data (but not user data - that comes from LevelManager)
      await Promise.all([
        this.loadItems(),
        this.loadMonsters(),
        this.loadLocations(),
        this.loadQuests(),
      ]);

      this.isInitialized = true;
      this.logger.info("AdventureManager initialized");

      return true;
    } catch (error) {
      this.logger.error("Failed to initialize AdventureManager: " + error);
      return false;
    }
  }

  /**
   * Load items data
   */
  async loadItems() {
    try {
      const itemsData = await this.loadDataFile(
        this.itemsFile,
        this.getDefaultItems()
      );

      // Convert to Map
      this.items.clear();
      for (const [itemId, itemData] of Object.entries(itemsData)) {
        this.items.set(itemId, itemData);
      }

      this.logger.info(`Loaded ${this.items.size} items`);
    } catch (error) {
      this.logger.error("Error loading items data: " + error);
    }
  }

  /**
   * Load monsters data
   */
  async loadMonsters() {
    try {
      const monstersData = await this.loadDataFile(
        this.monstersFile,
        this.getDefaultMonsters()
      );

      // Convert to Map
      this.monsters.clear();
      for (const [id, data] of Object.entries(monstersData)) {
        this.monsters.set(id, data);
      }

      this.logger.info(`Loaded ${this.monsters.size} monsters`);
    } catch (error) {
      this.logger.error("Error loading monsters data: " + error);
    }
  }

  /**
   * Load locations data
   */
  async loadLocations() {
    try {
      const locationsData = await this.loadDataFile(
        this.locationsFile,
        this.getDefaultLocations()
      );

      // Convert to Map
      this.locations.clear();
      for (const [id, data] of Object.entries(locationsData)) {
        this.locations.set(id, data);
      }

      this.logger.info(`Loaded ${this.locations.size} locations`);
    } catch (error) {
      this.logger.error("Error loading locations data: " + error);
    }
  }

  /**
   * Load quests data
   */
  async loadQuests() {
    try {
      const questsData = await this.loadDataFile(
        this.questsFile,
        this.getDefaultQuests()
      );

      // Convert to Map
      this.quests.clear();
      for (const [id, data] of Object.entries(questsData)) {
        this.quests.set(id, data);
      }

      this.logger.info(`Loaded ${this.quests.size} quests`);
    } catch (error) {
      this.logger.error("Error loading quests data: " + error);
    }
  }

  /**
   * Load a data file, creating it with default data if it doesn't exist
   */
  async loadDataFile(filePath, defaultData) {
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    } else {
      await fs.writeJson(filePath, defaultData, { spaces: 2 });
      return defaultData;
    }
  }

  /**
   * Save all game data files (not user data)
   */
  async saveAll() {
    await Promise.all([
      this.saveItems(),
      this.saveMonsters(),
      this.saveLocations(),
      this.saveQuests(),
    ]);

    this.logger.debug("All adventure game data saved");
  }

  /**
   * Save items data to file
   */
  async saveItems() {
    try {
      const data = Object.fromEntries(this.items);
      await fs.writeJson(this.itemsFile, data, { spaces: 2 });
      return true;
    } catch (error) {
      this.logger.error("Error saving items data: " + error);
      return false;
    }
  }

  /**
   * Save monsters data to file
   */
  async saveMonsters() {
    try {
      const data = Object.fromEntries(this.monsters);
      await fs.writeJson(this.monstersFile, data, { spaces: 2 });
      return true;
    } catch (error) {
      this.logger.error("Error saving monsters data: " + error);
      return false;
    }
  }

  /**
   * Save locations data to file
   */
  async saveLocations() {
    try {
      const data = Object.fromEntries(this.locations);
      await fs.writeJson(this.locationsFile, data, { spaces: 2 });
      return true;
    } catch (error) {
      this.logger.error("Error saving locations data: " + error);
      return false;
    }
  }

  /**
   * Save quests data to file
   */
  async saveQuests() {
    try {
      const data = Object.fromEntries(this.quests);
      await fs.writeJson(this.questsFile, data, { spaces: 2 });
      return true;
    } catch (error) {
      this.logger.error("Error saving quests data: " + error);
      return false;
    }
  }

  /**
   * Get or create user adventure data
   * @param {string} jid - User JID
   * @returns {Object} User adventure data
   */
  async getUserData(jid) {
    // Convert JID to a consistent format (strip @s.whatsapp.net if present)
    const userId = jid.split("@")[0];
    
    // Get user data from LevelManager
    const userData = this.terra.levelManager.getUserData(userId);
    
    // Check if user has adventure data initialized
    if (!userData.adventure) {
      // Initialize adventure data for this user
      userData.adventure = this._createDefaultAdventureData(userData);
      
      // Save the updated user data
      await this.updateUserData(jid, userData);
      
      this.logger.info(`Created new adventure profile for user ${userId}`);
    }
    
    return userData.adventure;
  }

  /**
   * Update user adventure data
   * @param {string} jid - User JID
   * @param {Object} userData - Full user data object
   */
  async updateUserData(jid, userData) {
    const userId = jid.split("@")[0];
    
    // Update the user data in LevelManager's database
    this.terra.levelManager.db.set(userId, userData);
    
    // LevelManager has auto-save, but we can force a save for important updates
    await this.terra.levelManager.saveData();
    
    return userData;
  }

  /**
   * Update just the adventure portion of user data
   * @param {string} jid - User JID 
   * @param {Object} adventureData - Adventure data to update
   */
  async updateAdventureData(jid, adventureData) {
    const userId = jid.split("@")[0];
    
    // Get full user data
    const fullUserData = this.terra.levelManager.getUserData(userId);
    
    // Update just the adventure portion
    fullUserData.adventure = adventureData;
    
    // Save the updated user data
    return await this.updateUserData(jid, fullUserData);
  }

  /**
   * Create default adventure data for a new user
   */
  _createDefaultAdventureData(userData) {
    return {
      // Basic info
      name: userData.pushName || "Adventurer",
      level: 1,
      xp: 0,
      xpNeeded: 100,

      // Main stats
      stats: {
        health: 100,
        maxHealth: 100,
        attack: 10,
        defense: 5,
        speed: 8,
      },

      // Inventory and currency
      inventory: {
        gold: 100,
        items: [],
      },

      // Equipment slots
      equipment: {
        weapon: null,
        armor: null,
        accessory: null,
      },

      // Progress tracking
      location: "town",
      questsCompleted: [],
      monstersDefeated: 0,

      // Activity timestamps - Using Unix timestamp (milliseconds)
      cooldowns: {
        hunt: 0,
        train: 0,
        daily: 0,
        quest: 0,
      },

      // Join date & last played
      joinedAt: Date.now(),
      lastPlayed: Date.now(),
    };
  }

  /**
   * Get default items data
   */
  getDefaultItems() {
    return {
      // WEAPONS
      sword_1: {
        name: "Wooden Sword",
        description: "A training sword made of wood",
        type: "weapon",
        rarity: "common",
        attack: 5,
        value: 50,
        required_level: 1,
        image: "🗡️",
      },
      sword_2: {
        name: "Iron Sword",
        description: "A standard iron sword",
        type: "weapon",
        rarity: "common",
        attack: 12,
        value: 200,
        required_level: 3,
        image: "🗡️",
      },
      sword_3: {
        name: "Steel Sword",
        description: "A well-crafted sword made of hardened steel",
        type: "weapon",
        rarity: "uncommon",
        attack: 18,
        value: 450,
        required_level: 7,
        image: "⚔️",
      },
      sword_4: {
        name: "Enchanted Blade",
        description: "A sword infused with magical energy",
        type: "weapon",
        rarity: "rare",
        attack: 25,
        special: "critical",
        critical_chance: 10,
        value: 1200,
        required_level: 15,
        image: "⚔️",
      },
      axe_1: {
        name: "Battle Axe",
        description: "A heavy axe that deals significant damage",
        type: "weapon",
        rarity: "uncommon",
        attack: 15,
        value: 300,
        required_level: 5,
        image: "🪓",
      },
      staff_1: {
        name: "Novice Staff",
        description: "A wooden staff with magical properties",
        type: "weapon",
        rarity: "uncommon",
        attack: 8,
        magic: 10,
        value: 250,
        required_level: 4,
        image: "🪄",
      },

      // ARMOR
      armor_1: {
        name: "Leather Armor",
        description: "Basic protection made from tanned hides",
        type: "armor",
        rarity: "common",
        defense: 5,
        value: 100,
        required_level: 1,
        image: "🥋",
      },
      armor_2: {
        name: "Chain Mail",
        description: "Interlocking metal rings offering good protection",
        type: "armor",
        rarity: "common",
        defense: 12,
        value: 350,
        required_level: 5,
        image: "🛡️",
      },
      armor_3: {
        name: "Steel Plate",
        description: "Heavy armor providing excellent protection",
        type: "armor",
        rarity: "uncommon",
        defense: 20,
        value: 800,
        required_level: 10,
        image: "🛡️",
      },
      armor_4: {
        name: "Enchanted Armor",
        description: "Armor reinforced with magical enchantments",
        type: "armor",
        rarity: "rare",
        defense: 25,
        magic_resistance: 15,
        value: 1500,
        required_level: 15,
        image: "⚡",
      },

      // ACCESSORIES
      ring_hp: {
        name: "Health Ring",
        description: "A ring that increases maximum health",
        type: "accessory",
        rarity: "uncommon",
        health: 20,
        value: 150,
        required_level: 3,
        image: "💍",
      },
      amulet_speed: {
        name: "Swift Amulet",
        description: "An amulet that increases speed",
        type: "accessory",
        rarity: "uncommon",
        speed: 5,
        value: 200,
        required_level: 5,
        image: "📿",
      },
      ring_atk: {
        name: "Ring of Power",
        description: "A ring that enhances attack strength",
        type: "accessory",
        rarity: "rare",
        attack: 8,
        value: 300,
        required_level: 8,
        image: "💍",
      },
      talisman_luck: {
        name: "Lucky Talisman",
        description: "Increases the chance of finding rare items",
        type: "accessory",
        rarity: "rare",
        luck: 15,
        value: 500,
        required_level: 10,
        image: "🔮",
      },

      // CONSUMABLES
      potion_health: {
        name: "Health Potion",
        description: "Restores 50 health points",
        type: "consumable",
        rarity: "common",
        restore: 50,
        value: 25,
        required_level: 1,
        image: "🧪",
      },
      potion_strength: {
        name: "Strength Potion",
        description: "Temporarily increases attack power by 5",
        type: "consumable",
        rarity: "uncommon",
        attackBoost: 5,
        duration: 600, // in seconds
        value: 75,
        required_level: 3,
        image: "🧪",
      },
      potion_defense: {
        name: "Defense Potion",
        description: "Temporarily increases defense by 5",
        type: "consumable",
        rarity: "uncommon",
        defenseBoost: 5,
        duration: 600, // in seconds
        value: 75,
        required_level: 3,
        image: "🧪",
      },
      food_basic: {
        name: "Basic Rations",
        description: "Restores 20 health points",
        type: "consumable",
        rarity: "common",
        restore: 20,
        value: 10,
        required_level: 1,
        image: "🍖",
      },

      // MATERIALS
      mat_leather: {
        name: "Leather",
        description: "Material used for crafting armor",
        type: "material",
        rarity: "common",
        value: 5,
        image: "🧶",
      },
      mat_iron: {
        name: "Iron Ore",
        description: "Material used for crafting weapons and armor",
        type: "material",
        rarity: "common",
        value: 8,
        image: "🪨",
      },
      mat_wood: {
        name: "Wood",
        description: "Basic crafting material",
        type: "material",
        rarity: "common",
        value: 3,
        image: "🪵",
      },
      mat_herb: {
        name: "Medicinal Herbs",
        description: "Used to create healing potions",
        type: "material",
        rarity: "common",
        value: 5,
        image: "🌿",
      },
    };
  }

  /**
   * Get default monsters data
   */
  getDefaultMonsters() {
    return {
      // BEGINNER MONSTERS (Level 1-5)
      slime: {
        name: "Slime",
        description: "A gelatinous creature that bounces around",
        minLevel: 1,
        maxLevel: 3,
        health: 20,
        attack: 5,
        defense: 2,
        speed: 3,
        xpReward: 10,
        goldReward: { min: 5, max: 15 },
        dropChance: 0.3,
        possibleDrops: ["potion_health", "mat_herb"],
        image: "🟢",
      },
      rat: {
        name: "Giant Rat",
        description: "An oversized rodent with sharp teeth",
        minLevel: 1,
        maxLevel: 4,
        health: 15,
        attack: 7,
        defense: 1,
        speed: 8,
        xpReward: 8,
        goldReward: { min: 3, max: 10 },
        dropChance: 0.4,
        possibleDrops: ["mat_leather"],
        image: "🐀",
      },
      wolf: {
        name: "Wolf",
        description: "A wild predator with sharp claws",
        minLevel: 2,
        maxLevel: 5,
        health: 40,
        attack: 10,
        defense: 3,
        speed: 10,
        xpReward: 20,
        goldReward: { min: 10, max: 25 },
        dropChance: 0.4,
        possibleDrops: ["potion_health", "mat_leather"],
        image: "🐺",
      },

      // INTERMEDIATE MONSTERS (Level 5-10)
      goblin: {
        name: "Goblin",
        description: "A small green-skinned creature with a wicked mind",
        minLevel: 3,
        maxLevel: 7,
        health: 60,
        attack: 15,
        defense: 5,
        speed: 7,
        xpReward: 35,
        goldReward: { min: 15, max: 40 },
        dropChance: 0.5,
        possibleDrops: ["potion_health", "mat_iron", "sword_1"],
        image: "👺",
      },
      skeleton: {
        name: "Skeleton",
        description: "An animated pile of bones",
        minLevel: 5,
        maxLevel: 9,
        health: 50,
        attack: 20,
        defense: 8,
        speed: 5,
        xpReward: 45,
        goldReward: { min: 20, max: 50 },
        dropChance: 0.6,
        possibleDrops: ["armor_1", "mat_iron"],
        image: "💀",
      },
      bandit: {
        name: "Bandit",
        description: "A ruthless thief looking for easy prey",
        minLevel: 6,
        maxLevel: 10,
        health: 80,
        attack: 18,
        defense: 10,
        speed: 9,
        xpReward: 50,
        goldReward: { min: 30, max: 70 },
        dropChance: 0.7,
        possibleDrops: ["sword_2", "potion_strength", "potion_health"],
        image: "🥷",
      },

      // ADVANCED MONSTERS (Level 10-15)
      troll: {
        name: "Troll",
        description: "A giant beast with regenerative abilities",
        minLevel: 10,
        maxLevel: 15,
        health: 150,
        attack: 25,
        defense: 15,
        speed: 4,
        xpReward: 100,
        goldReward: { min: 50, max: 120 },
        dropChance: 0.65,
        possibleDrops: ["armor_2", "potion_defense", "mat_leather"],
        image: "👹",
      },
      golem: {
        name: "Stone Golem",
        description: "A creature made of animated stone",
        minLevel: 12,
        maxLevel: 18,
        health: 200,
        attack: 20,
        defense: 30,
        speed: 3,
        xpReward: 120,
        goldReward: { min: 70, max: 150 },
        dropChance: 0.7,
        possibleDrops: ["mat_iron", "armor_3", "amulet_speed"],
        image: "🗿",
      },

      // BOSS MONSTERS (Level 15+)
      dragon: {
        name: "Young Dragon",
        description: "A fearsome dragon still growing into its power",
        minLevel: 15,
        maxLevel: 20,
        health: 300,
        attack: 40,
        defense: 25,
        speed: 12,
        xpReward: 200,
        goldReward: { min: 100, max: 250 },
        dropChance: 0.9,
        possibleDrops: ["sword_4", "armor_4", "ring_atk", "talisman_luck"],
        boss: true,
        image: "🐉",
      },
    };
  }

  /**
   * Get default locations data
   */
  getDefaultLocations() {
    return {
      town: {
        name: "Town",
        description: "A safe place to rest and resupply",
        safeZone: true,
        shopAvailable: true,
        trainAvailable: true,
        minLevel: 1,
        commonMonsters: [],
        rareMonsters: [],
        image: "🏘️",
      },
      forest: {
        name: "Forest",
        description: "A lush woodland teeming with wildlife",
        safeZone: false,
        shopAvailable: false,
        trainAvailable: false,
        minLevel: 1,
        commonMonsters: ["slime", "rat", "wolf"],
        rareMonsters: ["goblin"],
        image: "🌲",
      },
      cave: {
        name: "Cave",
        description: "A dark cavern with many dangers",
        safeZone: false,
        shopAvailable: false,
        trainAvailable: false,
        minLevel: 5,
        commonMonsters: ["goblin", "skeleton"],
        rareMonsters: ["troll"],
        image: "🕳️",
      },
      mountain: {
        name: "Mountain",
        description: "Treacherous peaks with powerful foes",
        safeZone: false,
        shopAvailable: false,
        trainAvailable: false,
        minLevel: 10,
        commonMonsters: ["troll", "golem"],
        rareMonsters: ["dragon"],
        image: "⛰️",
      },
    };
  }

  /**
   * Get default quests data
   */
  getDefaultQuests() {
    return {
      q1: {
        name: "Slime Extermination",
        description: "Defeat 5 slimes that are threatening the town",
        requirement: {
          type: "monster",
          monsterId: "slime",
          count: 5,
        },
        reward: {
          gold: 50,
          xp: 30,
          items: ["potion_health"],
        },
        minLevel: 1,
        image: "📜",
      },
      q2: {
        name: "Wolf Hunt",
        description: "Cull the wolf population by defeating 3 wolves",
        requirement: {
          type: "monster",
          monsterId: "wolf",
          count: 3,
        },
        reward: {
          gold: 100,
          xp: 60,
          items: ["sword_1"],
        },
        minLevel: 2,
        image: "📜",
      },
      q3: {
        name: "Bandit Leader",
        description:
          "Defeat the bandit leader who's been terrorizing travelers",
        requirement: {
          type: "monster",
          monsterId: "bandit",
          count: 1,
        },
        reward: {
          gold: 200,
          xp: 100,
          items: ["armor_2"],
        },
        minLevel: 6,
        image: "📜",
      },
    };
  }

  /**
   * Hunt for monsters and loot
   * @param {string} jid - User JID
   */
  async hunt(jid) {
    try {
      // Get user data
      const adventureData = await this.getUserData(jid);
  
      // Check cooldown
      const now = Date.now();
      if (adventureData.cooldowns.hunt > now) {
        const timeLeft = Math.ceil((adventureData.cooldowns.hunt - now) / 1000);
        return {
          success: false,
          message: `⏳ You're still resting from your last hunt! Try again in ${timeLeft} seconds.`,
        };
      }
  
      // Get user location
      const locationId = adventureData.location || "forest";
      const location = this.locations.get(locationId);
  
      if (!location) {
        return {
          success: false,
          message:
            "❌ Error: Invalid location. Please use .travel to go somewhere.",
        };
      }

      // Safety check - can't hunt in town
      if (location.safeZone) {
        return {
          success: false,
          message: `🏘️ You can't hunt in ${location.name} - it's a safe zone! Use .travel to go somewhere dangerous.`,
        };
      }

      // Random encounter logic
      const encounterRoll = Math.random();

      if (encounterRoll < 0.7) {
        // 70% chance of monster encounter
        const result = await this._monsterEncounter(adventureData, location);

        // Set cooldown (2 minutes)
        adventureData.cooldowns.hunt = now + this.COOLDOWNS.HUNT;
        if (result.adventureData) {
          await this.updateAdventureData(jid, result.adventureData);
        }
        return result;
      } else if (encounterRoll < 0.9) {
        // 20% chance of finding treasure
        const result = await this._findTreasure(adventureData, location);

        // Set cooldown (2 minutes)
        adventureData.cooldowns.hunt = now + this.COOLDOWNS.HUNT;
        await this.updateUserData(jid, adventureData);

        return result;
      } else {
        // 10% chance of nothing happening
        // Set cooldown (30 seconds only if nothing happens)
        adventureData.cooldowns.hunt = now + 30000;
        await this.updateUserData(jid, adventureData);

        return {
          success: true,
          message: `${location.image} You explored ${location.name} but didn't find anything interesting this time.`,
        };
      }
    } catch (error) {
      this.logger.error("Error in hunt function: " + error);
      return {
        success: false,
        message: "❌ An error occurred while hunting. Please try again.",
      };
    }
  }

  /**
   * Handle monster encounter during hunting
   * @param {Object} userData - User's adventure data
   * @param {Object} location - Location data
   */
  async _monsterEncounter(userData, location) {
    // Pick a monster based on location and user's level
    const monster = this._selectMonsterForLocation(location, userData.level);

    if (!monster) {
      return {
        success: false,
        message: "❌ No suitable monsters found for your level and location.",
      };
    }

    // Simple combat simulation
    const userDamage = Math.max(
      1,
      userData.stats.attack - Math.floor(monster.defense / 2)
    );
    const monsterDamage = Math.max(
      1,
      monster.attack - Math.floor(userData.stats.defense / 2)
    );

    // Calculate turns to defeat monster
    const userTurnsToWin = Math.ceil(monster.health / userDamage);
    const monsterTurnsToWin = Math.ceil(userData.stats.health / monsterDamage);

    // Determine combat outcome based on turns to win
    if (userTurnsToWin <= monsterTurnsToWin) {
      // User wins
      return this._handleCombatVictory(userData, monster);
    } else {
      // Monster wins
      return this._handleCombatDefeat(userData, monster);
    }
  }

  /**
   * Select a monster for the location based on user level
   * @param {Object} location - Location data
   * @param {number} userLevel - User's level
   */
  _selectMonsterForLocation(location, userLevel) {
    // Pool of possible monsters based on location and level
    const possibleMonsters = [];

    // Check common monsters
    if (location.commonMonsters && location.commonMonsters.length > 0) {
      for (const monsterId of location.commonMonsters) {
        const monster = this.monsters.get(monsterId);
        if (
          monster &&
          userLevel >= monster.minLevel &&
          userLevel <= monster.maxLevel + 3
        ) {
          // Add common monsters multiple times to increase their chance
          possibleMonsters.push(monster);
          possibleMonsters.push(monster);
        }
      }
    }

    // Check rare monsters
    if (location.rareMonsters && location.rareMonsters.length > 0) {
      for (const monsterId of location.rareMonsters) {
        const monster = this.monsters.get(monsterId);
        if (
          monster &&
          userLevel >= monster.minLevel &&
          userLevel <= monster.maxLevel + 2
        ) {
          // Add rare monsters once (less common)
          possibleMonsters.push(monster);
        }
      }
    }

    // If no suitable monsters found, return null
    if (possibleMonsters.length === 0) {
      return null;
    }

    // Randomly select a monster
    return possibleMonsters[
      Math.floor(Math.random() * possibleMonsters.length)
    ];
  }

  /**
   * Handle victory in combat
   * @param {Object} userData - User's adventure data
   * @param {Object} monster - Monster data
   */
  _handleCombatVictory(adventureData, monster) {
    // Calculate rewards
    const goldReward =
      monster.goldReward.min +
      Math.floor(
        Math.random() * (monster.goldReward.max - monster.goldReward.min + 1)
      );
    const xpReward = monster.xpReward;
  
    // Add rewards
    adventureData.inventory.gold += goldReward;
  
    // Add XP and check for level up
    const levelUpInfo = this._addXP(adventureData, xpReward);
  
    // Track monster defeated
    adventureData.monstersDefeated = (adventureData.monstersDefeated || 0) + 1;

    // Chance to drop item
    let itemMessage = "";
    let droppedItem = null;

    if (
      Math.random() < monster.dropChance &&
      monster.possibleDrops.length > 0
    ) {
      droppedItem =
        monster.possibleDrops[
          Math.floor(Math.random() * monster.possibleDrops.length)
        ];
      const itemData = this.items.get(droppedItem);

      if (itemData) {
        this._addItemToInventory(userData, droppedItem);
        itemMessage = `\n\n🎁 The ${monster.name} dropped: **${itemData.name}** ${itemData.image}!`;
      }
    }

    // Create victory message
    let message = `⚔️ You encountered a **${monster.name}** ${monster.image}!\n\n`;
    message += `After a fierce battle, you emerged victorious!\n`;
    message += `💰 Gained: ${goldReward} gold\n`;
    message += `✨ Gained: ${xpReward} XP${itemMessage}`;

    // Add level up message if applicable
    if (levelUpInfo.leveledUp) {
      message += `\n\n🎉 **LEVEL UP!** 🎉\n`;
      message += `You reached level ${userData.level}!\n`;
      message += `Your stats have increased!`;
    }

    return {
      success: true,
      message,
      combat: true,
      victory: true,
      rewards: {
        gold: goldReward,
        xp: xpReward,
        item: droppedItem,
      },
      levelUp: levelUpInfo.leveledUp,
      adventureData: adventureData
    };
  }

  /**
   * Handle defeat in combat
   * @param {Object} userData - User's adventure data
   * @param {Object} monster - Monster data
   */
  _handleCombatDefeat(userData, monster) {
    // Reduce user health to 25% of max when they lose
    userData.stats.health = Math.max(
      1,
      Math.floor(userData.stats.maxHealth * 0.25)
    );

    return {
      success: false,
      message: `⚔️ You encountered a **${monster.name}** ${monster.image}!\n\nIt was too strong for you! You were defeated and barely escaped with your life. Your health is now critically low. Rest or use potions to recover.`,
      combat: true,
      victory: false,
    };
  }

  /**
   * Find treasure while hunting
   * @param {Object} userData - User's adventure data
   * @param {Object} location - Location data
   */
  async _findTreasure(userData, location) {
    // Determine treasure quality based on user level
    const treasureQuality = Math.min(
      5,
      Math.max(1, Math.floor(userData.level / 5) + 1)
    );
    const goldBase = 20 * treasureQuality;
    const goldReward = goldBase + Math.floor(Math.random() * goldBase);

    // Add gold
    userData.inventory.gold += goldReward;

    // Chance to find an item
    if (Math.random() < 0.4) {
      // 40% chance to find item
      // Get items appropriate for user's level and treasure quality
      const possibleItems = Array.from(this.items.entries())
        .filter(
          ([id, item]) =>
            (!item.required_level || item.required_level <= userData.level) &&
            item.value <= goldBase * 2
        )
        .map(([id]) => id);

      if (possibleItems.length > 0) {
        const foundItemId =
          possibleItems[Math.floor(Math.random() * possibleItems.length)];
        const foundItem = this.items.get(foundItemId);
        this._addItemToInventory(userData, foundItemId);

        return {
          success: true,
          message: `💰 You found a treasure chest containing ${goldReward} gold and a **${foundItem.name}** ${foundItem.image}!`,
          treasure: true,
          rewards: {
            gold: goldReward,
            item: foundItemId,
          },
        };
      }
    }

    return {
      success: true,
      message: `💰 You found a treasure chest containing ${goldReward} gold!`,
      treasure: true,
      rewards: {
        gold: goldReward,
      },
    };
  }

  /**
   * Add XP to user and handle level ups
   * @param {Object} userData - User's adventure data
   * @param {number} amount - Amount of XP to add
   */
  _addXP(userData, amount) {
    userData.xp += amount;
    let leveledUp = false;
    let statIncreases = false;

    // Check for level up
    while (userData.xp >= userData.xpNeeded) {
      userData.xp -= userData.xpNeeded;
      userData.level += 1;
      leveledUp = true;

      // Increase stats on level up
      userData.stats.maxHealth += 10;
      userData.stats.health = userData.stats.maxHealth; // Heal to full on level up
      userData.stats.attack += 2;
      userData.stats.defense += 1;
      userData.stats.speed += 1;
      statIncreases = true;

      // Adjust XP needed for next level (exponential growth)
      userData.xpNeeded = Math.floor(100 * Math.pow(1.2, userData.level - 1));
    }

    return { leveledUp, statIncreases };
  }

  /**
   * Add item to user's inventory
   * @param {Object} userData - User's adventure data
   * @param {string} itemId - Item ID
   * @param {number} quantity - Quantity to add (default: 1)
   */
  _addItemToInventory(userData, itemId, quantity = 1) {
    // Make sure items array exists
    if (!userData.inventory.items) {
      userData.inventory.items = [];
    }

    // Find if item already exists
    const existingItem = userData.inventory.items.find(
      (item) => item.id === itemId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      userData.inventory.items.push({
        id: itemId,
        quantity: quantity,
      });
    }

    return userData;
  }

  /**
   * Remove item from user's inventory
   * @param {Object} userData - User's adventure data
   * @param {string} itemId - Item ID
   * @param {number} quantity - Quantity to remove (default: 1)
   */
  _removeItemFromInventory(userData, itemId, quantity = 1) {
    // Find item in inventory
    const itemIndex = userData.inventory.items.findIndex(
      (item) => item.id === itemId
    );

    if (itemIndex === -1) {
      return false; // Item not found
    }

    // Update quantity
    userData.inventory.items[itemIndex].quantity -= quantity;

    // Remove item if quantity reaches 0
    if (userData.inventory.items[itemIndex].quantity <= 0) {
      userData.inventory.items.splice(itemIndex, 1);
    }

    return true;
  }

  /**
   * Get item details by ID
   * @param {string} itemId - Item ID
   */
  getItemInfo(itemId) {
    return this.items.get(itemId) || null;
  }

  /**
   * Train to gain XP and potentially stat boosts
   * @param {string} jid - User JID
   */
  async train(jid) {
    try {
      // Get user data
      const adventureData = await this.getUserData(jid);
  
      // Check cooldown
      const now = Date.now();
      if (adventureData.cooldowns.train > now) {
        const timeLeft = Math.ceil((adventureData.cooldowns.train - now) / 1000);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
  
        return {
          success: false,
          message: `⏳ You're still tired from your last training session! You can train again in ${minutes}m ${seconds}s.`,
        };
      }
  
      // Calculate training results
      let xpGained = 15 + Math.floor(Math.random() * 10); // 15-24 XP
      let statBonus = null;
  
      // Small chance for stat boost
      const statBoostChance = 0.2; // 20% chance
      if (Math.random() < statBoostChance) {
        // Choose a stat to boost
        const stats = ["attack", "defense", "speed", "maxHealth"];
        const statToBoost = stats[Math.floor(Math.random() * stats.length)];
        const boostAmount = statToBoost === "maxHealth" ? 5 : 1;
  
        adventureData.stats[statToBoost] += boostAmount;
  
        // Also increase current health if maxHealth was boosted
        if (statToBoost === "maxHealth") {
          adventureData.stats.health += boostAmount;
        }
  
        statBonus = { stat: statToBoost, amount: boostAmount };
      }
  
      // Add XP
      const levelUpInfo = this._addXP(adventureData, xpGained);
  
      // Set cooldown (30 minutes)
      adventureData.cooldowns.train = now + this.COOLDOWNS.TRAIN;
  
      // Update user data with adventure data
      await this.updateAdventureData(jid, adventureData);
  
      // Create message
      let message = `🏋️ You completed your training session!\n\n`;
      message += `✨ Gained: ${xpGained} XP\n`;
  
      if (statBonus) {
        const statName =
          statBonus.stat === "maxHealth"
            ? "Health"
            : statBonus.stat.charAt(0).toUpperCase() + statBonus.stat.slice(1);
        message += `💪 Bonus: +${statBonus.amount} ${statName}\n`;
      }
  
      if (levelUpInfo.leveledUp) {
        message += `\n🎉 **LEVEL UP!** 🎉\n`;
        message += `You reached level ${adventureData.level}!\n`;
        message += `Your stats have increased!`;
      }
  
      return {
        success: true,
        message,
        xpGained,
        statBonus,
        levelUp: levelUpInfo.leveledUp,
      };
    } catch (error) {
      this.logger.error("Error in train function: " + error);
      return {
        success: false,
        message: "❌ An error occurred during training. Please try again.",
      };
    }
  }

  /**
   * Buy item from shop
   * @param {string} jid - User JID
   * @param {string} itemId - Item ID to buy
   */
  async buyItem(jid, itemId) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Check if item exists
      const item = this.items.get(itemId);
      if (!item) {
        return {
          success: false,
          message:
            "❌ Item not found in shop. Check the item ID and try again.",
        };
      }

      // Check if user meets level requirement
      if (item.required_level && userData.level < item.required_level) {
        return {
          success: false,
          message: `❌ You need to be level ${item.required_level} to buy this item. You are only level ${userData.level}.`,
        };
      }

      // Check if user has enough gold
      if (userData.inventory.gold < item.value) {
        return {
          success: false,
          message: `❌ You don't have enough gold to buy this item. You need ${item.value} gold.`,
        };
      }

      // Deduct gold
      userData.inventory.gold -= item.value;

      // Add item to inventory
      this._addItemToInventory(userData, itemId);

      // Save changes
      await this.updateUserData(jid, userData);

      return {
        success: true,
        message: `✅ You purchased a ${item.name} ${item.image} for ${
          item.value
        } gold! Use ${
          item.type === "consumable" ? ".use" : ".equip"
        } to use it.`,
      };
    } catch (error) {
      this.logger.error("Error in buyItem function: " + error);
      return {
        success: false,
        message: "❌ An error occurred while purchasing. Please try again.",
      };
    }
  }

  /**
   * Get items available in the shop
   * @param {number} userLevel - User's level (to filter by level requirement)
   */
  getShopItems(userLevel = 1) {
    // Convert items to array and filter by requirements
    return Array.from(this.items.entries())
      .filter(
        ([_, item]) => !item.required_level || item.required_level <= userLevel
      )
      .map(([id, item]) => ({
        id,
        ...item,
      }));
  }

  /**
   * Equip or use an item
   * @param {string} jid - User JID
   * @param {string} itemId - Item ID
   */
  async equipItem(jid, itemId) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Check if user has the item
      const inventoryItem = userData.inventory.items.find(
        (item) => item.id === itemId
      );
      if (!inventoryItem || inventoryItem.quantity < 1) {
        return {
          success: false,
          message: "❌ You don't have this item in your inventory.",
        };
      }

      // Get item data
      const item = this.items.get(itemId);
      if (!item) {
        return {
          success: false,
          message: "❌ This item doesn't exist in the database.",
        };
      }

      // Handle consumable items
      if (item.type === "consumable") {
        return await this._useConsumable(jid, userData, itemId, item);
      }

      // Handle equippable items
      if (["weapon", "armor", "accessory"].includes(item.type)) {
        // Check if something is already equipped in this slot
        const currentItem = userData.equipment[item.type];

        // Equip the new item
        userData.equipment[item.type] = itemId;

        // Remove the item from inventory
        this._removeItemFromInventory(userData, itemId);

        // If there was an item already equipped, add it back to inventory
        if (currentItem) {
          this._addItemToInventory(userData, currentItem);
        }

        // Save changes
        await this.updateUserData(jid, userData);

        const equippedItemName = item.name;
        const equippedItemImage = item.image || "";

        return {
          success: true,
          message: `✅ You equipped the ${equippedItemName} ${equippedItemImage}!`,
          equipType: item.type,
        };
      }

      return {
        success: false,
        message: "❌ This item cannot be equipped.",
      };
    } catch (error) {
      this.logger.error("Error in equipItem function: " + error);
      return {
        success: false,
        message: "❌ An error occurred while equipping item. Please try again.",
      };
    }
  }

  /**
   * Use a consumable item
   * @param {string} jid - User JID
   * @param {Object} userData - User's adventure data
   * @param {string} itemId - Item ID
   * @param {Object} item - Item data
   */
  async _useConsumable(jid, userData, itemId, item) {
    try {
      // Apply effects based on item
      let effectMessage = "";

      if (item.restore) {
        const oldHealth = userData.stats.health;
        userData.stats.health = Math.min(
          userData.stats.maxHealth,
          userData.stats.health + item.restore
        );
        const healAmount = userData.stats.health - oldHealth;

        effectMessage = `You used a ${item.name} ${item.image} and restored ${healAmount} health! (${userData.stats.health}/${userData.stats.maxHealth})`;
      } else if (item.attackBoost || item.defenseBoost || item.speedBoost) {
        effectMessage = `You used a ${item.name} ${item.image} and feel stronger!`;
        // Implementation for temporary stat boosts could be added here
      }

      // Remove the item from inventory
      this._removeItemFromInventory(userData, itemId);

      // Save changes
      await this.updateUserData(jid, userData);

      return {
        success: true,
        message: `✅ ${effectMessage}`,
      };
    } catch (error) {
      this.logger.error("Error in _useConsumable function: " + error);
      return {
        success: false,
        message: "❌ An error occurred while using this item.",
      };
    }
  }

  /**
   * Change user's location
   * @param {string} jid - User JID
   * @param {string} locationId - Location to travel to
   */
  async travel(jid, locationId) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Check if location exists
      const location = this.locations.get(locationId);
      if (!location) {
        return {
          success: false,
          message:
            "❌ That location doesn't exist. Check the location ID and try again.",
        };
      }

      // Check if user meets level requirement
      if (location.minLevel && userData.level < location.minLevel) {
        return {
          success: false,
          message: `❌ You need to be level ${location.minLevel} to travel to ${location.name}. You are only level ${userData.level}.`,
        };
      }

      // Change location
      userData.location = locationId;

      // Save changes
      await this.updateUserData(jid, userData);

      return {
        success: true,
        message: `🧳 You have traveled to ${location.name} ${location.image}\n\n${location.description}`,
      };
    } catch (error) {
      this.logger.error("Error in travel function: " + error);
      return {
        success: false,
        message: "❌ An error occurred while traveling. Please try again.",
      };
    }
  }

  /**
   * Get all available locations
   */
  getLocations() {
    return Array.from(this.locations.entries()).map(([id, location]) => ({
      id,
      ...location,
    }));
  }

  /**
   * Generate a rank card image
   * @param {string} jid - User JID
   */
  async generateRankCard(jid) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Create canvas
      const canvas = createCanvas(800, 300);
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#2b2d31";
      ctx.fillRect(0, 0, 800, 300);

      // Add border
      ctx.strokeStyle = "#5865f2";
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, 800, 300);

      // Add user info
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 40px Arial";
      ctx.fillText(userData.name || "Adventurer", 30, 70);

      // Add level info
      ctx.font = "bold 35px Arial";
      ctx.fillText(`Level: ${userData.level}`, 30, 120);

      // Add XP bar
      const barWidth = 700;
      const barHeight = 30;
      const barX = 50;
      const barY = 200;

      // XP bar background
      ctx.fillStyle = "#484b52";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Calculate XP progress
      const xpProgress = userData.xp / userData.xpNeeded;
      const progressWidth = Math.min(barWidth * xpProgress, barWidth);

      // XP bar fill
      ctx.fillStyle = "#5865f2";
      ctx.fillRect(barX, barY, progressWidth, barHeight);

      // XP text
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText(
        `XP: ${userData.xp} / ${userData.xpNeeded}`,
        barX + 10,
        barY + 22
      );

      // Stats
      ctx.font = "25px Arial";
      ctx.fillText(
        `❤️ HP: ${userData.stats.health}/${userData.stats.maxHealth}`,
        30,
        160
      );
      ctx.fillText(`⚔️ ATK: ${userData.stats.attack}`, 250, 160);
      ctx.fillText(`🛡️ DEF: ${userData.stats.defense}`, 400, 160);
      ctx.fillText(`⚡ SPD: ${userData.stats.speed}`, 550, 160);

      // Gold
      ctx.fillText(`💰 Gold: ${userData.inventory.gold}`, 550, 120);

      // Return buffer
      return canvas.toBuffer();
    } catch (error) {
      this.logger.error("Error generating rank card: " + error);
      return null;
    }
  }

  /**
   * Generate a detailed adventure card image
   * @param {string} jid - User JID
   * @returns {Buffer} The generated image as a buffer
   */
  async generateAdventureCard(jid) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Create canvas (wider to fit more information)
      const canvas = createCanvas(900, 500);
      const ctx = canvas.getContext("2d");

      // Background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 500);
      gradient.addColorStop(0, "#2c2f33");
      gradient.addColorStop(1, "#23272a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 900, 500);

      // Border with location-based color
      const locationColors = {
        town: "#5865f2", // Blue for town
        forest: "#57f287", // Green for forest
        cave: "#9b59b6", // Purple for cave
        mountain: "#eb459e", // Pink for mountain
      };
      const borderColor = locationColors[userData.location] || "#5865f2";

      // Add decorative border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 880, 480);

      // Add header with custom styling
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 45px Arial";
      ctx.fillText("ADVENTURE CARD", 30, 60);

      // Location indicator
      const location = this.locations.get(userData.location);
      if (location) {
        ctx.font = "24px Arial";
        ctx.fillStyle = borderColor;
        ctx.fillText(`${location.image} ${location.name}`, 450, 60);
      }

      // Adventure level badge (circle with level)
      ctx.beginPath();
      ctx.arc(800, 70, 50, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 40px Arial";
      ctx.textAlign = "center";
      ctx.fillText(userData.level.toString(), 800, 85);
      ctx.font = "20px Arial";
      ctx.fillText("LEVEL", 800, 115);
      ctx.textAlign = "left";

      // Character name and basic info
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 35px Arial";
      ctx.fillText(userData.name || "Adventurer", 30, 120);

      // Main stats
      ctx.font = "bold 28px Arial";
      ctx.fillText("⚔️ Stats", 30, 170);

      // Draw stats with nice bars
      this._drawStatBar(
        ctx,
        "❤️ HP",
        userData.stats.health,
        userData.stats.maxHealth,
        30,
        210
      );
      this._drawStatBar(ctx, "⚔️ ATK", userData.stats.attack, 100, 30, 260);
      this._drawStatBar(ctx, "🛡️ DEF", userData.stats.defense, 100, 30, 310);
      this._drawStatBar(ctx, "⚡ SPD", userData.stats.speed, 100, 30, 360);

      // Experience progress bar
      ctx.font = "bold 28px Arial";
      ctx.fillText("✨ Experience", 30, 420);

      // XP bar
      const xpBarWidth = 400;
      const xpBarHeight = 30;
      const xpBarX = 30;
      const xpBarY = 440;

      // XP bar background
      ctx.fillStyle = "#484b52";
      ctx.fillRect(xpBarX, xpBarY, xpBarWidth, xpBarHeight);

      // Calculate XP progress
      const xpProgress = userData.xp / userData.xpNeeded;
      const xpProgressWidth = Math.min(xpBarWidth * xpProgress, xpBarWidth);

      // XP bar fill with gradient
      const xpGradient = ctx.createLinearGradient(
        xpBarX,
        0,
        xpBarX + xpProgressWidth,
        0
      );
      xpGradient.addColorStop(0, "#5865f2");
      xpGradient.addColorStop(1, "#57f287");
      ctx.fillStyle = xpGradient;
      ctx.fillRect(xpBarX, xpBarY, xpProgressWidth, xpBarHeight);

      // XP text
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px Arial";
      ctx.fillText(
        `${userData.xp} / ${userData.xpNeeded} XP (${Math.floor(
          xpProgress * 100
        )}%)`,
        xpBarX + 10,
        xpBarY + 22
      );

      // Equipment section
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Arial";
      ctx.fillText("🎒 Equipment", 500, 170);
      ctx.font = "22px Arial";

      // Weapon
      let yPos = 210;
      if (userData.equipment.weapon) {
        const weapon = this.items.get(userData.equipment.weapon);
        if (weapon) {
          ctx.fillText(
            `${weapon.image || "🗡️"} Weapon: ${weapon.name}`,
            500,
            yPos
          );
          ctx.font = "18px Arial";
          ctx.fillStyle = "#cccccc";
          ctx.fillText(`Attack: +${weapon.attack || 0}`, 530, yPos + 25);
          ctx.font = "22px Arial";
          ctx.fillStyle = "#ffffff";
        }
      } else {
        ctx.fillText("🗡️ Weapon: None", 500, yPos);
      }

      // Armor
      yPos += 70;
      if (userData.equipment.armor) {
        const armor = this.items.get(userData.equipment.armor);
        if (armor) {
          ctx.fillText(
            `${armor.image || "🛡️"} Armor: ${armor.name}`,
            500,
            yPos
          );
          ctx.font = "18px Arial";
          ctx.fillStyle = "#cccccc";
          ctx.fillText(`Defense: +${armor.defense || 0}`, 530, yPos + 25);
          ctx.font = "22px Arial";
          ctx.fillStyle = "#ffffff";
        }
      } else {
        ctx.fillText("🛡️ Armor: None", 500, yPos);
      }

      // Accessory
      yPos += 70;
      if (userData.equipment.accessory) {
        const accessory = this.items.get(userData.equipment.accessory);
        if (accessory) {
          ctx.fillText(
            `${accessory.image || "💍"} Accessory: ${accessory.name}`,
            500,
            yPos
          );
          // Show the primary stat of the accessory
          ctx.font = "18px Arial";
          ctx.fillStyle = "#cccccc";
          let statText = "";
          if (accessory.health) statText = `Health: +${accessory.health}`;
          else if (accessory.attack) statText = `Attack: +${accessory.attack}`;
          else if (accessory.defense)
            statText = `Defense: +${accessory.defense}`;
          else if (accessory.speed) statText = `Speed: +${accessory.speed}`;
          ctx.fillText(statText, 530, yPos + 25);
          ctx.font = "22px Arial";
          ctx.fillStyle = "#ffffff";
        }
      } else {
        ctx.fillText("💍 Accessory: None", 500, yPos);
      }

      // Footer stats
      ctx.fillStyle = "#ffffff";
      ctx.font = "22px Arial";
      ctx.fillText(`💰 Gold: ${userData.inventory.gold}`, 500, 420);
      ctx.fillText(
        `👹 Monsters Defeated: ${userData.monstersDefeated || 0}`,
        500,
        450
      );

      // Return buffer
      return canvas.toBuffer();
    } catch (error) {
      this.logger.error("Error generating adventure card: " + error);
      return null;
    }
  }

  /**
   * Helper method to draw a stat bar
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} label - Stat label
   * @param {number} value - Current stat value
   * @param {number} max - Maximum stat value
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  _drawStatBar(ctx, label, value, max, x, y) {
    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px Arial";
    ctx.fillText(label, x, y);

    // Bar background
    const barWidth = 280;
    const barHeight = 25;
    const barX = x + 120;
    const barY = y - 20;

    ctx.fillStyle = "#484b52";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Calculate fill width
    const fillWidth = Math.min(barWidth * (value / max), barWidth);

    // Choose color based on stat type
    let fillColor = "#5865f2"; // Default blue
    if (label.includes("HP")) fillColor = "#ed4245"; // Red for HP
    else if (label.includes("ATK")) fillColor = "#eb459e"; // Pink for ATK
    else if (label.includes("DEF")) fillColor = "#57f287"; // Green for DEF
    else if (label.includes("SPD")) fillColor = "#fee75c"; // Yellow for SPD

    // Bar fill
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Bar border
    ctx.strokeStyle = "#23272a";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Value text
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px Arial";
    ctx.fillText(
      `${value}${max !== value ? "/" + max : ""}`,
      barX + 10,
      barY + 18
    );
  }

  /**
   * Claim daily rewards
   * @param {string} jid - User JID
   */
  async claimDaily(jid) {
    try {
      // Get user data
      const adventureData = await this.getUserData(jid);
  
      // Check cooldown
      const now = Date.now();
      if (adventureData.cooldowns.daily > now) {
        const timeLeft = Math.ceil((adventureData.cooldowns.daily - now) / 1000);
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
  
        return {
          success: false,
          message: `⏳ You've already claimed your daily reward! Come back in ${hours}h ${minutes}m.`,
        };
      }
  
      // Calculate rewards
      const goldReward = 100 + adventureData.level * 10;
      const xpReward = 20 + adventureData.level * 5;
  
      // Add rewards
      adventureData.inventory.gold += goldReward;
      const levelUpInfo = this._addXP(adventureData, xpReward);
  
      // Set cooldown (24 hours)
      adventureData.cooldowns.daily = now + this.COOLDOWNS.DAILY;
  
      // Update user data - using updateAdventureData instead of updateUserData
      await this.updateAdventureData(jid, adventureData);
  
      // Create message
      let message = `🎁 **Daily Reward Claimed!**\n\n`;
      message += `💰 Gold: +${goldReward}\n`;
      message += `✨ XP: +${xpReward}\n`;
  
      // Consecutive login streak could be added here
  
      if (levelUpInfo.leveledUp) {
        message += `\n🎉 **LEVEL UP!** 🎉\n`;
        message += `You reached level ${adventureData.level}!\n`;
        message += `Your stats have increased!`;
      }
  
      return {
        success: true,
        message,
        rewards: {
          gold: goldReward,
          xp: xpReward,
        },
        levelUp: levelUpInfo.leveledUp,
      };
    } catch (error) {
      this.logger.error("Error in claimDaily function: " + error);
      return {
        success: false,
        message:
          "❌ An error occurred while claiming daily reward. Please try again.",
      };
    }
  }

  /**
   * Get all available quests for the user
   * @param {string} jid - User JID
   */
  async getAvailableQuests(jid) {
    try {
      // Get user data
      const userData = await this.getUserData(jid);

      // Filter quests by level requirement and completion status
      const availableQuests = Array.from(this.quests.entries())
        .filter(
          ([questId, quest]) =>
            (!quest.minLevel || quest.minLevel <= userData.level) &&
            (!userData.questsCompleted ||
              !userData.questsCompleted.includes(questId))
        )
        .map(([id, quest]) => ({
          id,
          ...quest,
        }));

      return {
        success: true,
        quests: availableQuests,
      };
    } catch (error) {
      this.logger.error("Error in getAvailableQuests function: " + error);
      return {
        success: false,
        quests: [],
      };
    }
  }
}

module.exports = AdventureManager;
