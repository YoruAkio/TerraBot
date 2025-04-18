const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Check if a WebP file is animated
 * @param {string} filePath - Path to the WebP file
 * @returns {Promise<boolean>} - True if the WebP is animated
 */
async function isAnimatedWebp(filePath) {
  try {
    const metadata = await sharp(filePath, { animated: true }).metadata();
    return metadata.pages > 1; // If pages > 1, it's animated
  } catch (error) {
    // Alternative check using webpmux if sharp fails
    try {
      const { stdout } = await execAsync(`webpmux -info ${filePath}`);
      return stdout.includes('Animation: yes');
    } catch (e) {
      return false; // Default to static if we can't determine
    }
  }
}

module.exports = {
  name: 'toimage',
  description: 'Converts any sticker to an image (static or animated)',
  aliases: ['toimg', 'unsticker', 'stickertoimg'],
  usage: '{prefix}toimage (reply to a sticker)',
  cooldown: 5,
  category: 'media',
  execute: async (terra, msg, args, context) => {
    try {
      // Check if message is a reply to a sticker
      const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isSticker = quotedMessage?.stickerMessage;

      if (!isSticker) {
        return terra.reply(msg, "Please reply to a sticker with this command to convert it to an image.");
      }

      // Send processing message
      await terra.reply(msg, "⏳ Converting your sticker to image...");

      // For quoted messages, we need to construct a proper message object
      const quotedMsg = {
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
        },
        message: quotedMessage,
      };

      // Download the sticker
      let buffer;
      try {
        buffer = await downloadMediaMessage(
          quotedMsg,
          "buffer",
          {},
          {
            logger: terra.logger,
            reuploadRequest: terra.socket.updateMediaMessage,
          }
        );
      } catch (downloadError) {
        terra.logger.error("Error downloading sticker:", downloadError);
        return terra.reply(msg, `Error downloading sticker: ${downloadError.message}`);
      }

      if (!buffer) {
        return terra.reply(msg, "Failed to download the sticker. Please try again.");
      }

      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), "temp");
      await fs.ensureDir(tempDir);
      
      // Create a unique working directory for this conversion
      const workDir = path.join(tempDir, `sticker_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
      await fs.ensureDir(workDir);

      try {
        // Generate paths for files
        const inputPath = path.join(workDir, `input.webp`);
        const outputPathPng = path.join(workDir, `output.png`);
        const outputPathGif = path.join(workDir, `output.gif`);

        // Write buffer to file
        await fs.writeFile(inputPath, buffer);

        // Check if the sticker is animated or static
        const isAnimated = await isAnimatedWebp(inputPath);

        if (isAnimated) {
          // For animated stickers - convert to GIF directly
          await terra.reply(msg, "🎞️ Animated sticker detected, converting to GIF...");
          
          try {
            // Try to convert directly to GIF using sharp
            await sharp(inputPath, { animated: true })
              .toFormat('gif')
              .toFile(outputPathGif);
            
            const gifBuffer = await fs.readFile(outputPathGif);
            // await terra.messageUtils.sendImage(
            //   msg.key.remoteJid, 
            //   gifBuffer, 
            //   "✅ Animated sticker converted to GIF!", 
            //   { quoted: msg }
            // );
            await terra.sendGIF(
              msg.key.remoteJid, 
              gifBuffer, 
              "✅ Animated sticker converted to GIF!", 
              { quoted: msg }
            );
          } catch (gifError) {
            terra.logger.error(`Error converting to GIF: ${gifError.message}`);
            return terra.reply(msg, "Sorry, couldn't convert this animated sticker to GIF.");
          }
        } else {
          // For static stickers - convert to PNG
          try {
            await sharp(inputPath)
              .toFormat('png')
              .toFile(outputPathPng);

            const pngBuffer = await fs.readFile(outputPathPng);
            await terra.messageUtils.sendImage(
              msg.key.remoteJid, 
              pngBuffer, 
              "✅ Sticker converted to image!", 
              { quoted: msg }
            );
          } catch (imageError) {
            terra.logger.error("Error converting to PNG:", imageError);
            return terra.reply(msg, `Error converting sticker to image: ${imageError.message}`);
          }
        }
      } finally {
        // Clean up the working directory
        try {
          await fs.remove(workDir);
        } catch (cleanupError) {
          terra.logger.error("Error cleaning up temp files:", cleanupError);
        }
      }
    } catch (error) {
      terra.logger.error("Error in toimage command:", error);
      return terra.reply(msg, `Error converting sticker: ${error.message}`);
    }
  }
};