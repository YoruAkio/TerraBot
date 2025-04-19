const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");
const axios = require("axios");

/**
 * Canvas utility for generating images
 */
class CanvasManager {
  constructor() {
    // Register fonts
    this.initializeFonts();

    // Set font family based on what's available
    this.fontFamily = "JetBrains Mono, Arial, sans-serif";

    // Default colors
    this.colors = {
      background: "#18181b",
      backgroundSecondary: "#27272a",
      accent: "#a855f7",
      accentDark: "#9333ea",
      text: "#ffffff",
      textSecondary: "#a1a1aa",
      border: "#3f3f46",
      progressBg: "#3f3f46",
      progressFill: "#a855f7",
    };
  }

  /**
   * Initialize and register fonts
   */
  initializeFonts() {
    try {
      const fontsDir = path.join(process.cwd(), "assets", "fonts");

      // Ensure font directory exists
      fs.ensureDirSync(fontsDir);

      // Register only JetBrains Mono Bold
      const fontPath = path.join(fontsDir, "JetBrainsMono-Bold.ttf");

      // Flag to track if font was successfully loaded
      let fontLoaded = false;

      try {
        if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 0) {
          registerFont(fontPath, { family: "JetBrains Mono", weight: "bold" });
          fontLoaded = true;
          console.log(`Loaded font: ${path.basename(fontPath)}`);
          this.fontFamily = "JetBrains Mono, Arial, sans-serif";
        } else {
          console.log(
            `Font file not found or empty: ${path.basename(fontPath)}`
          );
        }
      } catch (fontError) {
        console.log(
          `Skipping font ${path.basename(fontPath)}: ${fontError.message}`
        );
      }

      // Log status of font loading
      if (!fontLoaded) {
        console.log("No custom fonts loaded, using system fonts instead");
        this.fontFamily = "Arial, sans-serif";
      }
    } catch (error) {
      console.error("Error initializing fonts:" + error);
      this.fontFamily = "Arial, sans-serif";
    }
  }

  /**
   * Download profile picture from WhatsApp
   * @param {object} sock WhatsApp socket
   * @param {string} jid User JID
   * @returns {Promise<Buffer|null>} Image buffer or null if not found
   */
  async getProfilePicture(sock, jid) {
    try {
      // Try to get profile picture URL from WhatsApp
      const ppUrl = await sock.profilePictureUrl(jid, "image");

      // Download the image
      const response = await axios.get(ppUrl, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (error) {
      return null; // No profile picture available
    }
  }

  /**
   * Generate a default avatar with user initials
   * @param {string} username Username for initials
   * @returns {Promise<Buffer>} Canvas buffer
   */
  async generateDefaultAvatar(username) {
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext("2d");

    // Generate a consistent color based on username
    const hash = username
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;

    // Fill background with user-specific color
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(0, 0, 200, 200);

    // Get initials (up to 2 characters)
    const initials = username
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word[0].toUpperCase())
      .slice(0, 2)
      .join("");

    // Draw text
    ctx.fillStyle = "white";
    ctx.font = `bold 80px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials || "?", 100, 100);

    return canvas.toBuffer("image/png");
  }

  /**
   * Create a profile card image
   * @param {object} userData User data object
   * @param {object} options Card options
   * @returns {Promise<Buffer>} Image buffer
   */
  async createProfileCard(userData, options = {}) {
    // Set up canvas with 16:9 aspect ratio (1080x608)
    const canvas = createCanvas(1080, 608);
    const ctx = canvas.getContext("2d");

    // Extract user data with defaults
    const {
      jid = "0",
      pushName = "User",
      xp = 0,
      level = 1,
      messages = 0,
      lastActive = Date.now(),
      joinedAt = Date.now(),
      groups = [],
    } = userData;

    const {
      progress = { percentage: 0, currentXp: 0, neededXp: 100 },
      rank = 0,
      profilePic = null,
    } = options;

    // IMPROVED: Card design with more rounded corners (radius 30px)
    const cardRadius = 30;

    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, "#1a1a22");
    bgGradient.addColorStop(1, "#18181b");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw card body with rounded corners
    ctx.fillStyle = this.colors.backgroundSecondary;
    this.roundedRect(
      ctx,
      40,
      40,
      canvas.width - 80,
      canvas.height - 80,
      cardRadius
    );

    // Add a subtle border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw top accent with rounded corners
    const accentHeight = 80;
    const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    accentGradient.addColorStop(0, this.colors.accent);
    accentGradient.addColorStop(1, this.colors.accentDark);
    ctx.fillStyle = accentGradient;

    // Only round the top corners of the accent bar
    this.roundedRectTop(
      ctx,
      40,
      40,
      canvas.width - 80,
      accentHeight,
      cardRadius
    );

    // Add profile picture or default avatar with improved shadow
    let avatarImage;
    try {
      if (profilePic) {
        avatarImage = await loadImage(profilePic);
      } else {
        // Generate a default avatar
        const defaultAvatar = await this.generateDefaultAvatar(pushName || jid);
        avatarImage = await loadImage(defaultAvatar);
      }

      // Add shadow for profile picture
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 170, 92, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      // Draw profile picture with circular mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 170, 90, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the image within the clip path
      ctx.drawImage(avatarImage, 60, 80, 180, 180);

      // Add a thick border around the profile picture
      ctx.strokeStyle = this.colors.accent;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    } catch (error) {
      console.error("Error loading profile image:" + error);
    }

    // Draw username with purple glow
    ctx.textAlign = "left";
    ctx.font = `bold 40px ${this.fontFamily}`;
    ctx.fillStyle = this.colors.text;
    ctx.shadowColor = this.colors.accent;
    ctx.shadowBlur = 15;
    ctx.fillText(pushName || jid, 280, 100);
    ctx.shadowBlur = 0;

    // Draw rank badge with more visual appeal
    const rankWidth = 140;
    const rankHeight = 50;
    const rankX = canvas.width - 220;
    const rankY = 170;

    // Badge background with gradient
    const rankGradient = ctx.createLinearGradient(
      rankX,
      rankY,
      rankX + rankWidth,
      rankY
    );
    rankGradient.addColorStop(0, this.colors.accent);
    rankGradient.addColorStop(1, this.colors.accentDark);

    ctx.fillStyle = rankGradient;
    this.roundedRect(ctx, rankX, rankY, rankWidth, rankHeight, 25);

    // Add inner stroke to rank badge
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rank text
    ctx.fillStyle = this.colors.text;
    ctx.font = `bold 24px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText(`RANK #${rank}`, rankX + rankWidth / 2, rankY + 32);

    // Reset text alignment
    ctx.textAlign = "left";

    // Draw level info
    ctx.font = `bold 32px ${this.fontFamily}`;
    ctx.fillStyle = this.colors.text;
    ctx.fillText(`Level ${level}`, 280, 180);

    // Draw XP progress bar with improved visuals
    const barWidth = 550;
    const barHeight = 24;
    const barX = 280;
    const barY = 200;
    const fillWidth = (progress.percentage / 100) * barWidth;

    // Progress bar background with rounded corners
    ctx.fillStyle = this.colors.progressBg;
    this.roundedRect(ctx, barX, barY, barWidth, barHeight, 12);

    // Progress bar fill with gradient
    if (progress.percentage > 0) {
      // Only draw progress fill if there is actual progress
      const progressGradient = ctx.createLinearGradient(
        barX,
        0,
        barX + barWidth,
        0
      );
      progressGradient.addColorStop(0, this.colors.accent);
      progressGradient.addColorStop(1, "#8b5cf6");

      ctx.fillStyle = progressGradient;

      // Special handling to ensure rounded corners still look good with partial fill
      if (progress.percentage < 100) {
        this.roundedRectLeft(ctx, barX, barY, fillWidth, barHeight, 12);
      } else {
        this.roundedRect(ctx, barX, barY, fillWidth, barHeight, 12);
      }
    }

    // Draw XP text
    ctx.font = `bold 16px ${this.fontFamily}`;
    ctx.fillStyle = this.colors.text;
    ctx.fillText(
      `${progress.currentXp.toLocaleString()}/${progress.neededXp.toLocaleString()} XP (${
        progress.percentage
      }%)`,
      barX + 10,
      barY + 17
    );

    // Draw stats section with improved header
    const statsY = 260;

    // Stats header with accent background
    const statsHeaderWidth = 100;
    const statsHeaderHeight = 32;
    ctx.fillStyle = this.colors.accent;
    this.roundedRect(
      ctx,
      100,
      statsY - 22,
      statsHeaderWidth,
      statsHeaderHeight,
      16
    );

    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.fillStyle = this.colors.text;
    ctx.textAlign = "center";
    ctx.fillText("STATS", 100 + statsHeaderWidth / 2, statsY + 1);
    ctx.textAlign = "left";

    // Add divider line
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(220, statsY - 6);
    ctx.lineTo(canvas.width - 100, statsY - 6);
    ctx.stroke();

    // Draw stats in two columns with custom icons instead of emojis
    const col1X = 100;
    const col2X = 540;
    let statsRowY = statsY + 50;

    // Format functions
    const formatNumber = (num) => num.toLocaleString();
    const formatTimeAgo = (timestamp) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days > 30) {
        return `${Math.floor(days / 30)} month${
          Math.floor(days / 30) !== 1 ? "s" : ""
        } ago`;
      } else if (days > 0) {
        return `${days} day${days !== 1 ? "s" : ""} ago`;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 0) {
        return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
      }

      return "Just now";
    };

    // Draw stats with custom icons instead of emojis
    const stats = [
      {
        label: "Messages",
        value: formatNumber(messages),
        x: col1X,
        color: "#9333ea",
      },
      {
        label: "Groups",
        value: formatNumber(groups.length),
        x: col2X,
        color: "#6366f1",
      },
      {
        label: "Last Active",
        value: formatTimeAgo(lastActive),
        x: col1X,
        color: "#ec4899",
      },
      {
        label: "Joined",
        value: formatTimeAgo(joinedAt),
        x: col2X,
        color: "#14b8a6",
      },
      {
        label: "Total XP",
        value: formatNumber(xp),
        x: col1X,
        color: "#f97316",
      },
    ];

    // Draw each stat with custom icon
    stats.forEach((stat, i) => {
      const y = statsRowY + Math.floor(i / 2) * 60;

      // Draw icon background
      ctx.fillStyle = stat.color + "30"; // Add transparency
      ctx.beginPath();
      ctx.arc(stat.x + 16, y - 12, 16, 0, Math.PI * 2);
      ctx.fill();

      // Draw stat label and value
      ctx.font = `bold 16px ${this.fontFamily}`;
      ctx.fillStyle = stat.color;
      ctx.fillText(stat.label, stat.x + 40, y - 12);

      ctx.font = `20px ${this.fontFamily}`;
      ctx.fillStyle = this.colors.text;
      ctx.fillText(stat.value, stat.x + 40, y + 12);
    });

    // Add footer badge
    const badgeWidth = 250;
    const badgeHeight = 32;
    const badgeX = (canvas.width - badgeWidth) / 2;
    const badgeY = canvas.height - 60;

    // Badge background with gradient
    const footerGradient = ctx.createLinearGradient(
      badgeX,
      0,
      badgeX + badgeWidth,
      0
    );
    footerGradient.addColorStop(0, "#6366f1");
    footerGradient.addColorStop(1, "#9333ea");

    ctx.fillStyle = footerGradient;
    this.roundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 16);

    // Badge text
    ctx.font = `bold 16px ${this.fontFamily}`;
    ctx.fillStyle = this.colors.text;
    ctx.textAlign = "center";
    ctx.fillText("Generated by TerraBot", badgeX + badgeWidth / 2, badgeY + 21);
    ctx.textAlign = "left";

    // Return buffer
    return canvas.toBuffer("image/png");
  }

  
  /**
   * Create an adventure card image with modern aesthetic styling
   * @param {object} userData User adventure data
   * @param {object} options Card options
   * @returns {Promise<Buffer>} Image buffer
   */
  async createAdventureCard(userData, options = {}) {
    // Set up canvas with 16:9 aspect ratio (1080x608)
    const canvas = createCanvas(1080, 608);
    const ctx = canvas.getContext("2d");

    // Extract adventure data with defaults
    const {
      name = "Adventurer",
      level = 1,
      xp = 0,
      xpNeeded = 100,
      stats = {
        health: 100,
        maxHealth: 100,
        attack: 10,
        defense: 5,
        speed: 8,
      },
      inventory = {
        gold: 100,
        items: [],
      },
      equipment = {
        weapon: null,
        armor: null,
        accessory: null,
      },
      location = "town",
      monstersDefeated = 0,
    } = userData;

    // Extract options with improved defaults
    const {
      profilePic = null,
      equipmentInfo = {},
      locationInfo = { name: "Town", image: "🏠" },
      pushName = null, // New parameter for user's WhatsApp name
    } = options;

    // Use pushName if available, then name from adventure data, then default to "Adventurer"
    const displayName = userData.pushName || name || "Adventurer";

    // Calculate XP percentage
    const xpPercentage = Math.min(100, Math.floor((xp / xpNeeded) * 100));

    // Define location-based colors
    const locationColors = {
      town: { primary: "#5856D6", secondary: "#7E57C2" }, // Purple theme
      forest: { primary: "#57F287", secondary: "#43A047" }, // Green theme
      cave: { primary: "#9B59B6", secondary: "#8E44AD" }, // Dark purple theme
      mountain: { primary: "#EB459E", secondary: "#D81B60" }, // Pink theme
      desert: { primary: "#F1C40F", secondary: "#F39C12" }, // Yellow theme
      beach: { primary: "#3498DB", secondary: "#2E86C1" }, // Blue theme
      dungeon: { primary: "#E74C3C", secondary: "#C0392B" }, // Red theme
    };

    // Get theme colors based on location or default to town colors
    const theme = locationColors[location] || locationColors.town;

    // Card dimensions and radius
    const cardRadius = 30;

    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, "#1a1a22");
    bgGradient.addColorStop(1, "#18181b");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw card body with rounded corners
    ctx.fillStyle = "#27272a";
    this.roundedRect(
      ctx,
      40,
      40,
      canvas.width - 80,
      canvas.height - 80,
      cardRadius
    );

    // Add a subtle border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw top accent with rounded corners
    const accentHeight = 80;
    const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    accentGradient.addColorStop(0, theme.primary);
    accentGradient.addColorStop(1, theme.secondary);
    ctx.fillStyle = accentGradient;

    // Only round the top corners of the accent bar
    this.roundedRectTop(
      ctx,
      40,
      40,
      canvas.width - 80,
      accentHeight,
      cardRadius
    );

    // Add profile picture or default avatar with improved shadow
    let avatarImage;
    try {
      if (profilePic) {
        avatarImage = await loadImage(profilePic);
      } else {
        // Generate a default avatar
        const defaultAvatar = await this.generateDefaultAvatar(displayName);
        avatarImage = await loadImage(defaultAvatar);
      }

      // Add shadow for profile picture
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 170, 92, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      // Draw profile picture with circular mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 170, 90, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the image within the clip path
      ctx.drawImage(avatarImage, 60, 80, 180, 180);

      // Add a thick border around the profile picture
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    } catch (error) {
      console.error("Error loading profile image:" + error);
    }

    // Draw character name with glow effect - using displayName now
    ctx.textAlign = "left";
    ctx.font = `bold 40px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 15;
    ctx.fillText(displayName, 280, 100);
    ctx.shadowBlur = 0;

    // Draw location badge
    const locationX = canvas.width - 220;
    const locationY = 85;
    const locationWidth = 170;
    const locationHeight = 40;

    // Location badge with gradient
    const locationGradient = ctx.createLinearGradient(
      locationX,
      locationY,
      locationX + locationWidth,
      locationY
    );
    locationGradient.addColorStop(0, theme.primary + "80"); // Semi-transparent
    locationGradient.addColorStop(1, theme.secondary + "80");

    ctx.fillStyle = locationGradient;
    this.roundedRect(
      ctx,
      locationX,
      locationY,
      locationWidth,
      locationHeight,
      20
    );

    // Location text - replace emoji with custom icon
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.textAlign = "center";

    // Draw location
    this.drawText(
      ctx,
      `${locationInfo.name || location}`,
      locationX + locationWidth / 2,
      locationY + 25
    );

    // Draw location icon instead of emoji
    this.drawLocationIcon(ctx, location, locationX + 20, locationY + 20);

    // Reset text alignment
    ctx.textAlign = "left";

    // Draw level info
    ctx.font = `bold 32px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Adventure Level ${level}`, 280, 180);

    // Draw XP progress bar with improved visuals
    const barWidth = 550;
    const barHeight = 24;
    const barX = 280;
    const barY = 200;
    const fillWidth = (xpPercentage / 100) * barWidth;

    // Progress bar background with rounded corners
    ctx.fillStyle = "#3f3f46";
    this.roundedRect(ctx, barX, barY, barWidth, barHeight, 12);

    // Progress bar fill with gradient
    if (xpPercentage > 0) {
      // Only draw progress fill if there is actual progress
      const progressGradient = ctx.createLinearGradient(
        barX,
        0,
        barX + barWidth,
        0
      );
      progressGradient.addColorStop(0, theme.primary);
      progressGradient.addColorStop(1, theme.secondary);

      ctx.fillStyle = progressGradient;

      // Special handling to ensure rounded corners still look good with partial fill
      if (xpPercentage < 100) {
        this.roundedRectLeft(ctx, barX, barY, fillWidth, barHeight, 12);
      } else {
        this.roundedRect(ctx, barX, barY, fillWidth, barHeight, 12);
      }
    }

    // Draw XP text
    ctx.font = `bold 16px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${xp.toLocaleString()}/${xpNeeded.toLocaleString()} XP (${xpPercentage}%)`,
      barX + 10,
      barY + 17
    );

    // IMPROVED: Position stats section in the center under the profile picture
    const statsY = 260;

    // Add divider line spanning most of the card
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, statsY - 6);
    ctx.lineTo(canvas.width - 90, statsY - 6);
    ctx.stroke();

    // Stats header with accent background - centered under profile picture
    const statsHeaderWidth = 100;
    const statsHeaderHeight = 32;
    ctx.fillStyle = theme.primary;
    this.roundedRect(
      ctx,
      150 - statsHeaderWidth / 2,
      statsY - 22,
      statsHeaderWidth,
      statsHeaderHeight,
      16
    );

    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("STATS", 150, statsY + 1);
    ctx.textAlign = "left";

    // IMPROVED: Make stat bars smaller and position them better
    const statBarY = statsY + 35; // Less space at top
    const statBarSpacing = 35; // Less space between bars
    const statBarWidth = 350; // Narrower bars
    const statBarHeight = 20; // Shorter bars

    // Draw stat bars with smaller custom icons
    this.drawStatBar(
      ctx,
      "HP",
      stats.health,
      stats.maxHealth,
      110,
      statBarY,
      statBarWidth,
      statBarHeight,
      "#FF5252",
      "#FF867F",
      this.drawHealthIcon.bind(this),
      true // small icon
    );

    this.drawStatBar(
      ctx,
      "ATK",
      stats.attack,
      100, // Max scale
      110,
      statBarY + statBarSpacing,
      statBarWidth,
      statBarHeight,
      "#FF9800",
      "#FFC107",
      this.drawAttackIcon.bind(this),
      true // small icon
    );

    this.drawStatBar(
      ctx,
      "DEF",
      stats.defense,
      100, // Max scale
      110,
      statBarY + statBarSpacing * 2,
      statBarWidth,
      statBarHeight,
      "#4CAF50",
      "#8BC34A",
      this.drawDefenseIcon.bind(this),
      true // small icon
    );

    this.drawStatBar(
      ctx,
      "SPD",
      stats.speed,
      100, // Max scale
      110,
      statBarY + statBarSpacing * 3,
      statBarWidth,
      statBarHeight,
      "#2196F3",
      "#03A9F4",
      this.drawSpeedIcon.bind(this),
      true // small icon
    );

    // IMPROVED: Position equipment section
    // Equipment section header
    ctx.fillStyle = theme.primary;
    this.roundedRect(ctx, 630, statsY - 22, 150, statsHeaderHeight, 16);

    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("EQUIPMENT", 705, statsY + 1);
    ctx.textAlign = "left";

    // Equipment items with improved spacing
    const equipmentX = 645;
    const equipmentSpacing = 30; // Same spacing as stat bars

    // Weapon with custom icon
    const weaponInfo = equipmentInfo.weapon || {
      name: "None",
      image: "",
      stats: {},
    };
    ctx.font = `bold 18px ${this.fontFamily}`; // Smaller font
    ctx.fillStyle = "#ffffff";

    // Draw weapon icon (smaller)
    this.drawWeaponIcon(ctx, equipmentX - 5, statBarY - 15 , true);
    ctx.fillText(`Weapon: ${weaponInfo.name}`, equipmentX + 28, statBarY);

    if (weaponInfo.stats && weaponInfo.stats.attack) {
      ctx.font = `15px ${this.fontFamily}`; // Smaller font
      ctx.fillStyle = "#FFC107";
      ctx.fillText(
        `+${weaponInfo.stats.attack} Attack`,
        equipmentX + 28,
        statBarY + 24
      );
    }

    // Armor with custom icon
    const armorInfo = equipmentInfo.armor || {
      name: "None",
      image: "",
      stats: {},
    };
    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";

    // Draw armor icon (smaller)
    this.drawArmorIcon(ctx, equipmentX - 5, statBarY + equipmentSpacing - 15, true);
    ctx.fillText(
      `Armor: ${armorInfo.name}`,
      equipmentX + 28,
      statBarY + equipmentSpacing
    );

    if (armorInfo.stats && armorInfo.stats.defense) {
      ctx.font = `15px ${this.fontFamily}`;
      ctx.fillStyle = "#8BC34A";
      ctx.fillText(
        `+${armorInfo.stats.defense} Defense`,
        equipmentX + 28,
        statBarY + equipmentSpacing + 24
      );
    }

    // Accessory with custom icon
    const accessoryInfo = equipmentInfo.accessory || {
      name: "None",
      image: "",
      stats: {},
    };
    ctx.font = `bold 18px ${this.fontFamily}`;
    ctx.fillStyle = "#ffffff";

    // Draw accessory icon (smaller)
    this.drawAccessoryIcon(
      ctx,
      equipmentX - 5,
      statBarY + equipmentSpacing * 2 - 15,
      true
    );
    ctx.fillText(
      `Accessory: ${accessoryInfo.name}`,
      equipmentX + 28,
      statBarY + equipmentSpacing * 2
    );

    if (accessoryInfo.stats) {
      ctx.font = `15px ${this.fontFamily}`;
      ctx.fillStyle = "#03A9F4";

      // Find the primary stat of the accessory
      const primaryStat = Object.entries(accessoryInfo.stats)[0];
      if (primaryStat) {
        ctx.fillText(
          `+${primaryStat[1]} ${
            primaryStat[0].charAt(0).toUpperCase() + primaryStat[0].slice(1)
          }`,
          equipmentX + 28,
          statBarY + equipmentSpacing * 2 + 24
        );
      }
    }

    // IMPROVED: Additional info section with better positioning and custom icons
    // Move this section lower to ensure it doesn't overlap with stats
    const infoY = statBarY + statBarSpacing * 4 + 10; // Positioned just below stats
    const infoSpacing = 30; // Smaller spacing between info items

    // Draw gold amount with custom icon
    ctx.font = `bold 16px ${this.fontFamily}`; // Slightly smaller font
    ctx.fillStyle = "#FFD700";
    this.drawGoldIcon(ctx, 110, infoY - 16, true);
    ctx.fillText(`Gold: ${inventory.gold.toLocaleString()}`, 140, infoY);

    // Draw monsters defeated with custom icon
    ctx.font = `bold 16px ${this.fontFamily}`;
    ctx.fillStyle = "#FF5252";
    this.drawMonsterIcon(ctx, 110, infoY + infoSpacing - 16, true);
    ctx.fillText(
      `Monsters Defeated: ${monstersDefeated.toLocaleString()}`,
      140,
      infoY + infoSpacing
    );

    // Draw inventory items count with custom icon
    ctx.font = `bold 16px ${this.fontFamily}`;
    ctx.fillStyle = "#8BC34A";
    this.drawInventoryIcon(ctx, 110, infoY + infoSpacing * 2 - 16, true);
    ctx.fillText(`Items: ${inventory.items.length}`, 140, infoY + infoSpacing * 2);

    // Add footer badge
    const badgeWidth = 300; // Wider badge
    const badgeHeight = 36; // Taller badge
    const badgeX = (canvas.width - badgeWidth) / 2;
    const badgeY = canvas.height - 60;

    // Badge background with gradient
    const footerGradient = ctx.createLinearGradient(
      badgeX,
      0,
      badgeX + badgeWidth,
      0
    );
    footerGradient.addColorStop(0, theme.primary);
    footerGradient.addColorStop(1, theme.secondary);

    ctx.fillStyle = footerGradient;
    this.roundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18);

    // Badge text
    ctx.font = `bold 18px ${this.fontFamily}`; // Increased font size
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      "TerraBot Adventure System",
      badgeX + badgeWidth / 2,
      badgeY + 24
    );
    ctx.textAlign = "left";

    // Return buffer
    return canvas.toBuffer("image/png");
  }

  /**
   * Draw a styled stat bar with label, value and icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {string} label Stat label
   * @param {number} value Current stat value
   * @param {number} max Maximum stat value
   * @param {number} x X position
   * @param {number} y Y position
   * @param {number} width Bar width
   * @param {number} height Bar height
   * @param {string} startColor Gradient start color
   * @param {string} endColor Gradient end color
   * @param {Function} iconDrawer Function to draw the stat icon
   * @param {boolean} smallIcon Whether to draw a smaller icon
   */
  drawStatBar(
    ctx,
    label,
    value,
    max,
    x,
    y,
    width,
    height,
    startColor,
    endColor,
    iconDrawer,
    smallIcon = false
  ) {
    // Draw stat icon instead of emoji
    if (iconDrawer) {
      iconDrawer(ctx, x, y - height / 2 - 5, smallIcon);
    }

    // Draw label
    ctx.font = `bold 16px ${this.fontFamily}`; // Smaller font
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + 25, y); // Moved closer to icon

    // Bar position and dimensions
    const barX = x + 70; // Less space for label + icon
    const barY = y - 14; // Adjusted vertical position
    const barWidth = width - 70;
    const barHeight = height;

    // Calculate fill width based on value/max
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const fillWidth = (percentage / 100) * barWidth;

    // Draw bar background
    ctx.fillStyle = "#3f3f46";
    this.roundedRect(ctx, barX, barY, barWidth, barHeight, 12); // Smaller corner radius

    // Draw fill with gradient
    if (percentage > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      gradient.addColorStop(0, startColor);
      gradient.addColorStop(1, endColor);
      ctx.fillStyle = gradient;

      // Handle rounded corners for partial fill
      if (percentage < 100) {
        this.roundedRectLeft(ctx, barX, barY, fillWidth, barHeight, 12);
      } else {
        this.roundedRect(ctx, barX, barY, fillWidth, barHeight, 12);
      }
    }

    // Add value text
    ctx.font = `bold 14px ${this.fontFamily}`; // Smaller font
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      `${value}${max !== value ? `/${max}` : ""}`,
      barX + barWidth / 2,
      barY + 15
    );
    ctx.textAlign = "left";
  }

  /**
   * Draw text that properly handles emoji
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {string} text Text to draw
   * @param {number} x X position
   * @param {number} y Y position
   */
  drawText(ctx, text, x, y) {
    // Remove emoji characters from text
    const cleanText = text
      .replace(
        /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ""
      )
      .trim();
    ctx.fillText(cleanText, x, y);
  }

  /**
   * Draw a health icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawHealthIcon(ctx, x, y, small = false) {
    // Draw a heart shape
    ctx.save();
    ctx.fillStyle = "#FF5252";
    ctx.beginPath();
    const size = small ? 16 : 20;

    // Heart shape
    ctx.moveTo(x + size / 2, y + size / 5);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 3);
    ctx.bezierCurveTo(
      x,
      y + size / 1.5,
      x + size / 2,
      y + size,
      x + size / 2,
      y + size
    );
    ctx.bezierCurveTo(
      x + size / 2,
      y + size,
      x + size,
      y + size / 1.5,
      x + size,
      y + size / 3
    );
    ctx.bezierCurveTo(x + size, y, x + size / 2, y, x + size / 2, y + size / 5);

    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw an attack icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawAttackIcon(ctx, x, y, small = false) {
    // Draw a sword
    ctx.save();
    ctx.fillStyle = "#FF9800";
    ctx.strokeStyle = "#FFC107";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Sword blade
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y - size / 3);
    ctx.lineTo(x + size, y + size / 2);
    ctx.lineTo(x + size / 1.3, y + size);
    ctx.lineTo(x + size / 4, y + size / 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sword handle
    ctx.fillStyle = "#8D6E63";
    ctx.beginPath();
    ctx.rect(x, y + size / 1.5, size / 4, size / 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a defense icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawDefenseIcon(ctx, x, y, small = false) {
    // Draw a shield
    ctx.save();
    ctx.fillStyle = "#4CAF50";
    ctx.strokeStyle = "#8BC34A";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Shield
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y - size / 3);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size, y + size / 1.2);
    ctx.quadraticCurveTo(x + size / 2, y + size * 1.2, x, y + size / 1.2);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shield emblem
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + size / 6);
    ctx.lineTo(x + size / 1.5, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 1.2);
    ctx.lineTo(x + size / 3, y + size / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw a speed icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawSpeedIcon(ctx, x, y, small = false) {
    // Draw lightning bolt
    ctx.save();
    ctx.fillStyle = "#2196F3";
    ctx.strokeStyle = "#03A9F4";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Lightning bolt
    ctx.beginPath();
    ctx.moveTo(x + size / 1.2, y - size / 3);
    ctx.lineTo(x + size / 3, y + size / 2);
    ctx.lineTo(x + size / 1.5, y + size / 1.8);
    ctx.lineTo(x + size / 1.2, y + size / 1.8);
    ctx.lineTo(x + size / 3, y + size * 1.2);
    ctx.lineTo(x + size / 1.1, y + size / 2);
    ctx.lineTo(x + size / 1.8, y + size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a weapon icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawWeaponIcon(ctx, x, y, small = false) {
    // Draw a sword
    ctx.save();
    ctx.fillStyle = "#FF9800";
    ctx.strokeStyle = "#FFC107";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Sword blade
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y - size / 5);
    ctx.lineTo(x + size, y + size / 2);
    ctx.lineTo(x + size / 1.3, y + size);
    ctx.lineTo(x + size / 4, y + size / 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sword handle
    ctx.fillStyle = "#8D6E63";
    ctx.beginPath();
    ctx.rect(x, y + size / 1.5, size / 4, size / 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw an armor icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawArmorIcon(ctx, x, y, small = false) {
    // Draw armor chestpiece
    ctx.save();
    ctx.fillStyle = "#8BC34A";
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Armor body
    ctx.beginPath();
    ctx.moveTo(x + size / 4, y);
    ctx.lineTo(x + size / 1.3, y);
    ctx.lineTo(x + size, y + size / 3);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size / 1.5, y + size / 1.2);
    ctx.lineTo(x + size / 2, y + size);
    ctx.lineTo(x + size / 3, y + size / 1.2);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x, y + size / 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw an accessory icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawAccessoryIcon(ctx, x, y, small = false) {
    // Draw a ring
    ctx.save();
    ctx.fillStyle = "#03A9F4";
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Outer circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Gem on top
    ctx.fillStyle = "#E1F5FE";
    ctx.beginPath();
    ctx.arc(x + size / 2, y, size / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a gold icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawGoldIcon(ctx, x, y, small = false) {
    // Draw gold coin
    ctx.save();
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#FFC107";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Coin outer circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Coin inner details
    ctx.fillStyle = "#F57F17";
    ctx.font = `bold ${size * 0.7}px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", x + size / 2, y + size / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.restore();
  }

  /**
   * Draw a monster icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawMonsterIcon(ctx, x, y, small = false) {
    // Draw monster face
    ctx.save();
    ctx.fillStyle = "#FF5252";

    const size = small ? 16 : 20;

    // Monster head
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Monster eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x + size / 3, y + size / 2.5, size / 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + size / 1.5, y + size / 2.5, size / 6, 0, Math.PI * 2);
    ctx.fill();

    // Monster pupils
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x + size / 3, y + size / 2.5, size / 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + size / 1.5, y + size / 2.5, size / 12, 0, Math.PI * 2);
    ctx.fill();

    // Monster mouth
    ctx.beginPath();
    ctx.moveTo(x + size / 3, y + size / 1.5);
    ctx.lineTo(x + size / 1.5, y + size / 1.5);
    ctx.lineTo(x + size / 2, y + size / 1.2);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw an inventory icon
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {boolean} small Whether to draw a smaller icon
   */
  drawInventoryIcon(ctx, x, y, small = false) {
    // Draw backpack
    ctx.save();
    ctx.fillStyle = "#8BC34A";
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = small ? 1.5 : 2;

    const size = small ? 16 : 20;

    // Backpack body
    ctx.beginPath();
    ctx.roundRect(x, y + size / 4, size, size / 1.2, 5);
    ctx.fill();
    ctx.stroke();

    // Backpack top flap
    ctx.beginPath();
    ctx.roundRect(x + size / 6, y, size / 1.5, size / 4, 4);
    ctx.fill();
    ctx.stroke();

    // Backpack pocket
    ctx.fillStyle = "#689F38";
    ctx.beginPath();
    ctx.roundRect(x + size / 4, y + size / 2, size / 2, size / 3, 3);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a location icon based on type
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {string} locationType Location type
   * @param {number} x X position
   * @param {number} y Y position
   */
  drawLocationIcon(ctx, locationType, x, y) {
    ctx.save();

    const size = 16;

    switch (locationType) {
      case "town":
        // Draw a house
        ctx.fillStyle = "#9575CD";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x, y + size);
        ctx.closePath();
        ctx.fill();

        // Roof
        ctx.fillStyle = "#7E57C2";
        ctx.beginPath();
        ctx.moveTo(x - size / 4, y);
        ctx.lineTo(x + size / 2, y - size / 2);
        ctx.lineTo(x + size + size / 4, y);
        ctx.closePath();
        ctx.fill();
        break;

      case "forest":
        // Draw trees
        ctx.fillStyle = "#43A047";

        // First tree
        ctx.beginPath();
        ctx.moveTo(x, y + size / 2);
        ctx.lineTo(x + size / 3, y - size / 2);
        ctx.lineTo(x + size / 1.5, y + size / 2);
        ctx.closePath();
        ctx.fill();

        // Second tree
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + size / 2);
        ctx.lineTo(x + size / 1.2, y - size / 3);
        ctx.lineTo(x + size, y + size / 2);
        ctx.closePath();
        ctx.fill();
        break;

      case "cave":
        // Draw cave entrance
        ctx.fillStyle = "#8E44AD";
        ctx.beginPath();
        ctx.arc(x + size / 2, y, size / 1.5, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        // Inner darkness
        ctx.fillStyle = "#6D1B7B";
        ctx.beginPath();
        ctx.arc(x + size / 2, y, size / 2.5, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        break;

      case "mountain":
        // Draw mountains
        ctx.fillStyle = "#D81B60";

        // First mountain
        ctx.beginPath();
        ctx.moveTo(x - size / 4, y + size / 2);
        ctx.lineTo(x + size / 2, y - size / 2);
        ctx.lineTo(x + size + size / 4, y + size / 2);
        ctx.closePath();
        ctx.fill();

        // Snow cap
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y - size / 2);
        ctx.lineTo(x + size / 2 + size / 6, y - size / 3);
        ctx.lineTo(x + size / 2 - size / 6, y - size / 3);
        ctx.closePath();
        ctx.fill();
        break;

      default:
        // Default simple circle
        ctx.fillStyle = "#5856D6";
        ctx.beginPath();
        ctx.arc(x + size / 2, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Helper function to draw rounded rectangles
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {number} width Rectangle width
   * @param {number} height Rectangle height
   * @param {number} radius Corner radius
   */
  roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Helper function to draw rectangles with only top corners rounded
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {number} width Rectangle width
   * @param {number} height Rectangle height
   * @param {number} radius Corner radius
   */
  roundedRectTop(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Helper function to draw rectangles with only left corners rounded
   * @param {CanvasRenderingContext2D} ctx Canvas context
   * @param {number} x X position
   * @param {number} y Y position
   * @param {number} width Rectangle width
   * @param {number} height Rectangle height
   * @param {number} radius Corner radius
   */
  roundedRectLeft(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
}

module.exports = CanvasManager;
