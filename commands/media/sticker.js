const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const crypto = require('crypto');
const { Image } = require('node-webpmux');
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Add this import

/**
 * Add exif metadata to a webp sticker
 * @param {Buffer} webpSticker - Webp sticker buffer
 * @param {string} packname - Sticker pack name
 * @param {string} author - Sticker author
 * @param {string[]} categories - Emoji categories
 * @returns {Promise<Buffer>} - Sticker with exif data
 */
async function addExif(webpSticker, packname, author, categories = ["😎"]) {
  const img = new Image();
  const stickerPackId = crypto.randomBytes(32).toString("hex");
  const json = {
    "sticker-pack-id": stickerPackId,
    "sticker-pack-name": packname,
    "sticker-pack-publisher": author,
    emojis: categories,
  };
  let exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  let jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  let exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  await img.load(webpSticker);
  img.exif = exif;
  return await img.save(null);
}

/**
 * Check if file is too large for WhatsApp stickers
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if file is too large
 */
async function isFileTooLarge(filePath) {
  const stats = await fs.stat(filePath);
  // WhatsApp animated sticker size limit (in bytes) - 500KB is safe
  const MAX_STICKER_SIZE = 500 * 1024; 
  return stats.size > MAX_STICKER_SIZE;
}

module.exports = {
  name: 'sticker',
  description: 'Converts media to a sticker',
  aliases: ['stikr', 'stkr', 's'],
  usage: '{prefix}sticker [caption] or reply to a message/mention to create profile pic sticker',
  cooldown: 10,
  category: 'media',
  execute: async (terra, msg, args, context) => {
    try {
      // Check if message contains media or is a reply to media
      const isImage = msg.message?.imageMessage;
      const isVideo = msg.message?.videoMessage;
      const isViewOnce = msg.message?.viewOnceMessage;
      const isViewOnceImage = isViewOnce?.message?.imageMessage;
      const isViewOnceVideo = isViewOnce?.message?.videoMessage;

      // Check if message is a reply to media
      const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedImage = quotedMessage?.imageMessage;
      const quotedVideo = quotedMessage?.videoMessage;
      const quotedViewOnce = quotedMessage?.viewOnceMessage;
      const quotedViewOnceImage = quotedViewOnce?.message?.imageMessage;
      const quotedViewOnceVideo = quotedViewOnce?.message?.videoMessage;

      // Check if message is a reply to any message (for profile pic)
      const isReply = !!msg.message?.extendedTextMessage?.contextInfo?.participant;
      const repliedUserJid = msg.message?.extendedTextMessage?.contextInfo?.participant;

      // Check for mentions (for profile pic)
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const hasMention = mentionedJid.length > 0;

      // If no media in message or quoted message, but there's a reply or mention, get profile pic
      const shouldUseProfilePic =
        !isImage &&
        !isVideo &&
        !isViewOnceImage &&
        !isViewOnceVideo &&
        !quotedImage &&
        !quotedVideo &&
        !quotedViewOnceImage &&
        !quotedViewOnceVideo &&
        (isReply || hasMention);

      if (
        !shouldUseProfilePic &&
        !isImage &&
        !isVideo &&
        !isViewOnceImage &&
        !isViewOnceVideo &&
        !quotedImage &&
        !quotedVideo &&
        !quotedViewOnceImage &&
        !quotedViewOnceVideo
      ) {
        return terra.reply(msg, "Please send or reply to an image/video, or reply to a message/mention a user to create a profile pic sticker.");
      }

      // Send processing message
      await terra.reply(msg, "⏳ Processing your media...");

      // Download the media
      let buffer;
      let isVideoMedia = false;

      try {
        if (shouldUseProfilePic) {
          // Use profile picture of replied user or mentioned user
          const targetJid = repliedUserJid || mentionedJid[0];
          
          try {
            // Get the profile picture URL
            const ppUrl = await terra.contactManager.getProfilePicture(targetJid);
            
            if (!ppUrl) {
              return terra.reply(msg, "Could not get profile picture. User may not have a profile picture or it's private.");
            }
            
            // Download the profile picture
            const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
            
            terra.logger.info(`Downloaded profile picture for ${targetJid}`);
          } catch (ppError) {
            terra.logger.error("Error getting profile picture:", ppError);
            return terra.reply(msg, "Could not get profile picture. User may not have a profile picture or it's private.");
          }
        } else if (isImage || isViewOnceImage) {
          // Use Baileys downloadMediaMessage directly
          buffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            {
              logger: terra.logger,
              reuploadRequest: terra.socket.updateMediaMessage,
            }
          );
        } else if (isVideo || isViewOnceVideo) {
          buffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            {
              logger: terra.logger,
              reuploadRequest: terra.socket.updateMediaMessage,
            }
          );
          isVideoMedia = true;
        } else if (quotedImage || quotedViewOnceImage) {
          const quotedMsg = {
            key: {
              remoteJid: msg.key.remoteJid,
              id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
            },
            message: quotedMessage,
          };
          
          buffer = await downloadMediaMessage(
            quotedMsg,
            "buffer",
            {},
            {
              logger: terra.logger,
              reuploadRequest: terra.socket.updateMediaMessage,
            }
          );
        } else if (quotedVideo || quotedViewOnceVideo) {
          const quotedMsg = {
            key: {
              remoteJid: msg.key.remoteJid,
              id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
            },
            message: quotedMessage,
          };
          
          buffer = await downloadMediaMessage(
            quotedMsg,
            "buffer",
            {},
            {
              logger: terra.logger,
              reuploadRequest: terra.socket.updateMediaMessage,
            }
          );
          isVideoMedia = true;
        }
      } catch (downloadError) {
        terra.logger.error("Error downloading media:", downloadError);
        return terra.reply(msg, `Error downloading media: ${downloadError.message}`);
      }

      if (!buffer) {
        return terra.reply(msg, "Failed to download media. Please try again.");
      }

      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), "temp");
      await fs.ensureDir(tempDir);

      // Generate random filename
      const randomName = Math.floor(Math.random() * 10000);
      const inputPath = path.join(tempDir, `input_${randomName}`);
      
      // Different output paths for different media types
      const outputPathSticker = path.join(tempDir, `output_${randomName}.webp`);
      const outputPathGif = path.join(tempDir, `output_${randomName}.gif`);

      // Write buffer to file
      await fs.writeFile(inputPath, buffer);

      // Process media based on type
      if (isVideoMedia) {
        // First get video information to calculate 50% resolution (reduced from 60%)
        const videoInfo = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
          });
        });
        
        // Calculate 50% of original dimensions (reduced from 60%)
        const originalWidth = videoInfo.streams[0].width || 640;
        const originalHeight = videoInfo.streams[0].height || 480;
        const targetWidth = Math.floor(originalWidth * 0.5);
        const targetHeight = Math.floor(originalHeight * 0.5);
        
        // Convert video to GIF using ffmpeg with optimized settings for WhatsApp
        await terra.reply(msg, "🎬 Converting video to sticker (optimizing for WhatsApp size limits)...");
        
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .setDuration(3) // Reduced from 10 seconds to 3 seconds for WhatsApp compatibility
            .size(`${targetWidth}x${targetHeight}`) // Reduced to 50% of original
            .fps(12) // Reduced from 15 to 12 FPS for smaller file size
            .output(outputPathGif)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
        
        // Create a sticker version with lower quality for smaller file size
        await sharp(outputPathGif, { animated: true })
          .resize(384, 384, { // Reduced from 512x512 to 384x384
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .webp({ 
            quality: 50, // Lower quality for smaller file size
            effort: 6, // Higher compression effort
            loop: 0, // Infinite loop
            delay: 100, // 100ms delay between frames (10 FPS)
            force: true
          })
          .toFile(outputPathSticker);
          
        // If the sticker is still too large, try to optimize it further
        if (await isFileTooLarge(outputPathSticker)) {
          terra.logger.info("First sticker attempt was too large, creating smaller version...");
          
          // Create an even smaller sticker
          await sharp(outputPathGif, { animated: true })
            .resize(256, 256, { // Even smaller size
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .webp({ 
              quality: 35, // Lower quality
              effort: 6,
              loop: 0,
              delay: 120, // Slower animation (8.3 FPS)
              force: true
            })
            .toFile(outputPathSticker);
        }
      } else {
        // Convert image to webp using sharp
        await sharp(inputPath)
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .webp({
            quality: 80, // Better quality for static images
            effort: 6,
            force: true
          })
          .toFile(outputPathSticker);
          
        // If the sticker is still too large, optimize it further
        if (await isFileTooLarge(outputPathSticker)) {
          await sharp(inputPath)
            .resize(384, 384, { // Reduced size
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .webp({
              quality: 65, // Lower quality
              effort: 6,
              force: true
            })
            .toFile(outputPathSticker);
        }
      }

      // Read the processed sticker file
      const stickerBuffer = await fs.readFile(outputPathSticker);

      // Check if user is owner to use owner pack
      const senderJid = msg.key.remoteJid.split("@")[0];
      const isOwner = terra.config?.owner?.jid?.includes(senderJid) || terra.isOwner(msg.key.remoteJid);

      // Select sticker pack info based on user status
      let packInfo = {
        name: 'TerraBot Pack',
        author: '@terraBot',
        categories: ['😎', '🤖', '✨']
      };
      
      // If there's a config for stickers and user is owner requesting owner pack
      if (terra.config?.stickers?.ownerPack && isOwner && args.includes("--owner")) {
        packInfo = terra.config.stickers.ownerPack;
      } else if (terra.config?.stickers?.packInfo) {
        packInfo = terra.config.stickers.packInfo;
      }

      // Add exif metadata to the sticker
      const stickerWithExif = await addExif(
        stickerBuffer,
        packInfo.name,
        packInfo.author,
        packInfo.categories || ["😎", "🤖"]
      );

      // Send the sticker (for all media types)
      await terra.messageUtils.sendSticker(msg.key.remoteJid, stickerWithExif, { quoted: msg });

      // Clean up temp files
      try {
        await fs.unlink(inputPath);
        await fs.unlink(outputPathSticker);
        if (isVideoMedia) {
          await fs.unlink(outputPathGif);
        }
      } catch (cleanupError) {
        terra.logger.error("Error cleaning up temp files:", cleanupError);
      }
    } catch (error) {
      terra.logger.error("Error processing media:", error);
      return terra.reply(msg, `Error creating sticker: ${error.message}. This might be because the video is too large or in an unsupported format.`);
    }
  }
};