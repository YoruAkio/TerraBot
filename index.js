const Terra = require('./src/Terra');
const path = require('path');
const fs = require('fs-extra');

// Version info
const VERSION = '1.0.0';

console.log(`
╔════════════════════════════════════════════╗
║              TerraBot v${VERSION}              ║
║     WhatsApp Bot Framework for Node.js     ║
╚════════════════════════════════════════════╝
`);

// Check if config exists, create if not
const configPath = path.join(process.cwd(), 'config.json');
let config;

if (!fs.existsSync(configPath)) {
  // Create default config
  config = {
    prefix: '!',
    ownerNumber: '',  // Set this to your WhatsApp number with country code
    statusMessage: '🤖 TerraBot Active | Use !help for commands',
    sessionPath: path.join(process.cwd(), 'sessions'),
    logLevel: 'info',
    maxReconnects: 5,
    reconnectInterval: 3000,
    enableMessageLogging: true,
    enableReadReceipts: true,
    enableTypingIndicator: true,
    typingTimeout: 3000,
    connectionTimeout: 60000,
    qrTimeout: 60000
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('📄 Created default config.json');
} else {
  // Load existing config
  try {
    config = require(configPath);
    console.log('📄 Loaded config.json');
  } catch (error) {
    console.error('❌ Error loading config.json: ' + error);
    process.exit(1);
  }
}

// Create required directories
const directories = ['sessions', 'temp', 'commands', 'events'];
directories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created ${dir} directory`);
  }
});

// Initialize bot
const bot = new Terra(config);

// Start bot with better error handling
(async () => {
  try {
    await bot.start();
  } catch (error) {
    console.error('❌ Failed to start TerraBot: ' + error);
    process.exit(1);
  }
})();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception: ' + error);
  // Log but don't exit to keep bot running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection:', reason);
  // Log but don't exit to keep bot running
});

console.log('🤖 TerraBot is ready!');