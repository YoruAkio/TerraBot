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
          console.log(`Font file not found or empty: ${path.basename(fontPath)}`);
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
      console.error("Error initializing fonts:", error);
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
  this.roundedRect(ctx, 40, 40, canvas.width - 80, canvas.height - 80, cardRadius);
  
  // Add a subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw top accent with rounded corners
  const accentHeight = 80;
  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, this.colors.accent);
  accentGradient.addColorStop(1, this.colors.accentDark);
  ctx.fillStyle = accentGradient;
  
  // Only round the top corners of the accent bar
  this.roundedRectTop(ctx, 40, 40, canvas.width - 80, accentHeight, cardRadius);

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
    console.error("Error loading profile image:", error);
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
  const rankGradient = ctx.createLinearGradient(rankX, rankY, rankX + rankWidth, rankY);
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
      barX, 0, barX + barWidth, 0
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
  this.roundedRect(ctx, 100, statsY - 22, statsHeaderWidth, statsHeaderHeight, 16);
  
  ctx.font = `bold 18px ${this.fontFamily}`;
  ctx.fillStyle = this.colors.text;
  ctx.textAlign = "center";
  ctx.fillText("STATS", 100 + statsHeaderWidth/2, statsY + 1);
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
    { label: "Messages", value: formatNumber(messages), x: col1X, color: "#9333ea" },
    { label: "Groups", value: formatNumber(groups.length), x: col2X, color: "#6366f1" },
    { label: "Last Active", value: formatTimeAgo(lastActive), x: col1X, color: "#ec4899" },
    { label: "Joined", value: formatTimeAgo(joinedAt), x: col2X, color: "#14b8a6" },
    { label: "Total XP", value: formatNumber(xp), x: col1X, color: "#f97316" },
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
  const footerGradient = ctx.createLinearGradient(badgeX, 0, badgeX + badgeWidth, 0);
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