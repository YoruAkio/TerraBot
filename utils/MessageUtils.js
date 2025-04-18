const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const mime = require('mime-types');
const { promisify } = require('util');
const fileType = require('file-type');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class MessageUtils {
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: 'MessageUtils' });
  }

  /**
   * Get buffer from URL
   * @param {string} url URL to fetch
   * @returns {Promise<Buffer>} Buffer
   */
  async getBufferFromUrl(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Error downloading from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get buffer from file path or URL
   * @param {string|Buffer} source File path, URL or Buffer
   * @returns {Promise<Buffer>} Buffer
   */
  async getBuffer(source) {
    try {
      // If already a buffer, return as is
      if (Buffer.isBuffer(source)) {
        return source;
      }
      
      // If URL, download
      if (typeof source === 'string') {
        if (source.startsWith('http://') || source.startsWith('https://')) {
          return await this.getBufferFromUrl(source);
        } else {
          // Assume it's a file path
          if (await fs.pathExists(source)) {
            return await fs.readFile(source);
          }
        }
      }
      
      throw new Error('Invalid media source');
    } catch (error) {
      this.logger.error('Error getting media buffer:', error);
      throw error;
    }
  }

  /**
   * Send image message
   * @param {string} jid Chat JID
   * @param {string|Buffer} image Image path or buffer
   * @param {string} caption Image caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendImage(jid, image, caption = '', options = {}) {
    try {
      const buffer = await this.getBuffer(image);
      
      const message = {
        image: buffer,
        caption: caption,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending image to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send video message
   * @param {string} jid Chat JID
   * @param {string|Buffer} video Video path or buffer
   * @param {string} caption Video caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendVideo(jid, video, caption = '', options = {}) {
    try {
      const buffer = await this.getBuffer(video);
      
      const message = {
        video: buffer,
        caption: caption,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending video to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send audio message
   * @param {string} jid Chat JID
   * @param {string|Buffer} audio Audio path or buffer
   * @param {boolean} ptt Is voice note
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendAudio(jid, audio, ptt = false, options = {}) {
    try {
      const buffer = await this.getBuffer(audio);
      
      // Get mimetype
      let mimetype;
      if (typeof audio === 'string' && audio.includes('.')) {
        mimetype = mime.lookup(audio) || 'audio/mpeg';
      } else {
        const type = await fileType.fromBuffer(buffer);
        mimetype = type ? type.mime : 'audio/mpeg';
      }
      
      const message = {
        audio: buffer,
        ptt: ptt,
        mimetype: mimetype,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending audio to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send document message
   * @param {string} jid Chat JID
   * @param {string|Buffer} document Document path or buffer
   * @param {string} filename Document filename
   * @param {string} caption Document caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendDocument(jid, document, filename, caption = '', options = {}) {
    try {
      const buffer = await this.getBuffer(document);
      
      // Get mimetype
      let mimetype;
      if (filename.includes('.')) {
        mimetype = mime.lookup(filename) || 'application/octet-stream';
      } else {
        const type = await fileType.fromBuffer(buffer);
        mimetype = type ? type.mime : 'application/octet-stream';
      }
      
      const message = {
        document: buffer,
        mimetype: mimetype,
        fileName: filename,
        caption: caption,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending document to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send sticker message
   * @param {string} jid Chat JID
   * @param {string|Buffer} sticker Sticker path or buffer
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendSticker(jid, sticker, options = {}) {
    try {
      const buffer = await this.getBuffer(sticker);
      
      const message = {
        sticker: buffer,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending sticker to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send location message
   * @param {string} jid Chat JID
   * @param {object} coordinates Coordinates {latitude, longitude}
   * @param {string} caption Location caption
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendLocation(jid, coordinates, caption = '', options = {}) {
    try {
      const { latitude, longitude } = coordinates;
      
      if (!latitude || !longitude) {
        throw new Error('Invalid coordinates');
      }
      
      const message = {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude
        },
        caption: caption,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending location to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send contact message
   * @param {string} jid Chat JID
   * @param {string|string[]|object|object[]} contacts Contact(s) to send
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendContact(jid, contacts, options = {}) {
    try {
      // Format single contact
      const formatContact = (contact) => {
        // If just a string (number), create simple contact
        if (typeof contact === 'string') {
          return {
            displayName: contact,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${contact}\nTEL;type=CELL;type=VOICE;waid=${contact}:+${contact}\nEND:VCARD`
          };
        }
        
        // If object with name and number
        const { name, number, org = '' } = contact;
        return {
          displayName: name,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${org}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`
        };
      };
      
      // Handle array of contacts or single contact
      let formattedContacts;
      if (Array.isArray(contacts)) {
        formattedContacts = contacts.map(formatContact);
      } else {
        formattedContacts = [formatContact(contacts)];
      }
      
      const message = {
        contacts: {
          displayName: formattedContacts.length > 1 
            ? `${formattedContacts.length} contacts` 
            : formattedContacts[0].displayName,
          contacts: formattedContacts
        },
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending contact to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send button message
   * @param {string} jid Chat JID
   * @param {string} content Button content
   * @param {array} buttons Array of buttons
   * @param {string} footer Footer text
   * @param {object} options Message options
   * @returns {Promise<object>} Message info
   */
  async sendButtons(jid, content, buttons, footer = '', options = {}) {
    try {
      // Format buttons to baileys format if not already
      const formattedButtons = buttons.map((btn, index) => {
        if (typeof btn === 'string') {
          return { buttonId: `btn_${index}`, buttonText: { displayText: btn }, type: 1 };
        } else if (btn.id && btn.text) {
          return { buttonId: btn.id, buttonText: { displayText: btn.text }, type: 1 };
        }
        return btn;
      });
      
      const message = {
        text: content,
        footer: footer,
        buttons: formattedButtons,
        headerType: 1,
        ...options
      };
      
      return await this.terra.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Error sending button message to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * React to a message
   * @param {object} msg Message to react to
   * @param {string} emoji Emoji to react with
   * @returns {Promise<object>} Message info
   */
  async react(msg, emoji) {
    try {
      return await this.terra.sendMessage(msg.key.remoteJid, {
        react: {
          text: emoji,
          key: msg.key
        }
      });
    } catch (error) {
      this.logger.error(`Error reacting to message:`, error);
      throw error;
    }
  }

  /**
   * Download media from a message
   * @param {object} msg Message containing media
   * @returns {Promise<Buffer>} Media buffer
   */
  async downloadMedia(msg) {
    try {
      if (!msg.message) {
        throw new Error('No message found');
      }

      // Download the media
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: this.logger, reuploadRequest: this.terra.socket.updateMediaMessage }
      );
      
      return buffer;
    } catch (error) {
      this.logger.error('Error downloading media:', error);
      throw error;
    }
  }
}

module.exports = MessageUtils;