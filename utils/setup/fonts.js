const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

async function downloadFont() {
  try {
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    await fs.ensureDir(fontsDir);
    
    const fontUrl = 'https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf';
    const outputPath = path.join(fontsDir, 'JetBrainsMono-Bold.ttf');
    
    console.log('Downloading JetBrains Mono Bold font...');
    const response = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    
    await fs.writeFile(outputPath, Buffer.from(response.data));
    console.log('Font downloaded successfully!');
    
    return true;
  } catch (error) {
    console.error('Error downloading font:' + error.message);
    return false;
  }
}

// Execute if called directly
if (require.main === module) {
  downloadFont()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = downloadFont;