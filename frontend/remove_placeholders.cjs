const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('@ts-expect-error - TS Migration placeholder')) {
      const lines = content.split('\n');
      const newLines = lines.filter(line => !line.includes('@ts-expect-error - TS Migration placeholder'));
      fs.writeFileSync(filePath, newLines.join('\n'));
      console.log(`Cleaned placeholders from ${filePath}`);
    }
  }
});
