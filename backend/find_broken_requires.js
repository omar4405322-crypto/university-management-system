const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const appJsPath = path.join(srcDir, 'app.js');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

const allFiles = [];
walkDir(srcDir, (f) => {
  if (f.endsWith('.js') || f.endsWith('.ts')) {
    allFiles.push(f);
  }
});
// also check app.js/app.ts if it exists outside src or in src
if (fs.existsSync(appJsPath) && !allFiles.includes(appJsPath)) {
    allFiles.push(appJsPath);
}

const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

let brokenRequires = [];
let tsRequiredFiles = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // Ignore node_modules
    if (!importPath.startsWith('.')) continue;

    const dir = path.dirname(file);
    const resolvedBase = path.join(dir, importPath);

    // Node resolution logic (simplified)
    let existsJs = fs.existsSync(resolvedBase + '.js') || fs.existsSync(path.join(resolvedBase, 'index.js'));
    let existsTs = fs.existsSync(resolvedBase + '.ts') || fs.existsSync(path.join(resolvedBase, 'index.ts'));
    let existsExact = fs.existsSync(resolvedBase);

    if (existsExact && fs.statSync(resolvedBase).isDirectory()) {
       existsJs = existsJs || fs.existsSync(path.join(resolvedBase, 'index.js'));
       existsTs = existsTs || fs.existsSync(path.join(resolvedBase, 'index.ts'));
    }

    if (!existsExact && !existsJs && !existsTs) {
      // Entirely missing
      brokenRequires.push({ file: path.relative(__dirname, file), importPath });
    } else if (!existsJs && !existsExact && existsTs && file.endsWith('.js')) {
      // Required from .js but only exists as .ts
      tsRequiredFiles.push({ file: path.relative(__dirname, file), importPath, resolvedTs: path.relative(__dirname, resolvedBase + '.ts') });
    }
  }
});

console.log("=== TS Files Required by JS ===");
console.log(JSON.stringify(tsRequiredFiles, null, 2));

console.log("\n=== Entirely Missing Requires ===");
console.log(JSON.stringify(brokenRequires, null, 2));
