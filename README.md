# 🤖 TerraBot

<div align="center">

![TerraBot](https://img.shields.io/badge/TerraBot-WhatsApp%20Bot-brightgreen?style=for-the-badge)
![Bun](https://img.shields.io/badge/Bun-Runtime-orange?style=for-the-badge&logo=bun)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

A powerful WhatsApp bot with rich media capabilities, built with [Baileys](https://github.com/WhiskeySockets/baileys) and [Bun](https://bun.sh).

</div>

## ✨ Features

- **💬 WhatsApp Integration** - Seamlessly connects with WhatsApp using Baileys
- **🖼️ Media Processing** - Convert, create, and modify images, videos, and stickers
- **🚀 Modular Commands** - Organized command structure for easy extensibility
- **⚡ Fast Performance** - Built with Bun for lightning-fast execution
- **🔄 Sticker Tools** - Convert media to stickers and vice versa
- **👤 User Management** - Profile pictures and user tracking features

## 📋 Prerequisites

- [Bun](https://bun.sh) v1.0.0+
- FFmpeg (for video processing)
- libwebp (for WebP image processing)

## 🚀 Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/TerraBot.git
cd TerraBot
```

2. Install dependencies:

```bash
bun install
```

3. Configure your settings in the config.json file (see Configuration section)

## ⚙️ Configuration

TerraBot uses a config.json file for all settings. Here's an example with explanations:

```json
{
  "name": "TerraBot",
  "prefix": "!",
  "statusMessage": "🤖 TerraBot Active | Use !help for commands",
  "sessionPath": "./sessions",
  "logLevel": "info",
  
  "maxReconnects": 5,
  "reconnectInterval": 3000,
  "connectionTimeout": 60000,
  "qrTimeout": 60000,
  
  "enableMessageLogging": true,
  "enableReadReceipts": true,
  "enableTypingIndicator": true,
  "typingTimeout": 3000,
  
  "privateMode": false,
  "owners": [
    "628xxxxxxx",
    "628xxxxxxx"
  ],
  "leveling": {
    "enabled": true,
    "levelUpMessages": false
  }
}
```

### Key Configuration Options:

- **Basic Settings**
  - `name`: Bot display name
  - `prefix`: Command prefix (e.g., `!` for commands like `!sticker`)
  - `statusMessage`: WhatsApp status message
  
- **Connection Settings**
  - `sessionPath`: Where session data is stored
  - `maxReconnects`: Maximum reconnection attempts
  - `reconnectInterval`: Time between reconnection attempts (ms)
  - `qrTimeout`: How long to wait for QR code scan (ms)

- **Feature Toggles**
  - `enableMessageLogging`: Log incoming/outgoing messages
  - `enableReadReceipts`: Send read receipts
  - `enableTypingIndicator`: Show typing indicator when processing commands
  
- **Access Control**
  - `privateMode`: When true, only owners can use the bot
  - `owners`: List of phone numbers (with country code) of bot owners

## 🏃‍♂️ Running the Bot

Start the bot with:

```bash
bun run index.js
```

Scan the QR code with your WhatsApp to connect.

## 📚 Commands

### Media Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `!sticker` | `!s`, `!stikr`, `!stkr` | Convert media to sticker |
| `!toimage` | `!toimg`, `!unsticker` | Convert sticker back to image/GIF |
| `!avatar` | `!pfp`, `!dp` | Display user profile picture |

### Usage Examples

Convert an image to a sticker:
```
!sticker
```
(Reply to an image or send with caption)

Convert a sticker back to an image:
```
!toimage
```
(Reply to a sticker)

## 🧩 Project Structure

```
TerraBot/
├── commands/         # Bot commands organized by category
│   ├── media/        # Media processing commands
│   └── ...
├── lib/              # Core bot functionality
├── utils/            # Utility functions
├── index.js          # Entry point
├── config.json       # Bot configuration
└── README.md         # This file
```

## 🔧 Advanced Features

### Sticker Options

The bot supports various customization options for stickers:

- Custom pack name and author info
- Animated sticker support
- Quality and size optimization
- Emoji categories

### Media Conversion

TerraBot can convert between multiple formats:
- Images to stickers
- Videos to animated stickers
- Stickers to images/GIFs
- Profile pictures to stickers

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/baileys) for WhatsApp Web API
- [Bun](https://bun.sh) for the fast JavaScript runtime
- [Sharp](https://sharp.pixelplumbing.com/) for image processing
- [FFmpeg](https://ffmpeg.org/) for video processing

---

<div align="center">
  
Made with ❤️ by [YoruAkio](https://github.com/YoruAkio) & TerraDev Team

</div>