const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let renamed = 0;
walkDir(path.join(__dirname, 'src'), function(filePath) {
  if (filePath.endsWith('.jsx')) {
    const newPath = filePath.replace(/\.jsx$/, '.tsx');
    fs.renameSync(filePath, newPath);
    renamed++;
    console.log(`Renamed: ${path.basename(filePath)} -> ${path.basename(newPath)}`);
  } else if (filePath.endsWith('.js')) {
    const newPath = filePath.replace(/\.js$/, '.ts');
    fs.renameSync(filePath, newPath);
    renamed++;
    console.log(`Renamed: ${path.basename(filePath)} -> ${path.basename(newPath)}`);
  }
});

console.log(`\nSuccessfully renamed ${renamed} files.`);
