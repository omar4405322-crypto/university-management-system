const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

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

const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
const importRegex = /from\s+['"]([^'"]+)['"]/g;
const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

let brokenReferences = [];
let tsRequiredFiles = [];
let missingCompletely = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  const checkPath = (importPath, type) => {
    if (!importPath.startsWith('.')) return; // Ignore node_modules

    // Remove extension if present in importPath for generic resolution, though node usually requires it or uses .js
    const resolvedBase = path.join(dir, importPath.replace(/\.js$/, '').replace(/\.ts$/, ''));
    
    let existsJs = fs.existsSync(resolvedBase + '.js') || fs.existsSync(path.join(resolvedBase, 'index.js'));
    let existsTs = fs.existsSync(resolvedBase + '.ts') || fs.existsSync(path.join(resolvedBase, 'index.ts'));
    let existsExact = fs.existsSync(resolvedBase);
    let existsExactJs = fs.existsSync(resolvedBase) && resolvedBase.endsWith('.js');

    // If it's a directory
    if (existsExact && fs.statSync(resolvedBase).isDirectory()) {
       existsJs = existsJs || fs.existsSync(path.join(resolvedBase, 'index.js'));
       existsTs = existsTs || fs.existsSync(path.join(resolvedBase, 'index.ts'));
    }

    if (!existsExact && !existsJs && !existsTs) {
      missingCompletely.push({ file: path.relative(__dirname, file), importPath, type });
    } else if (!existsJs && (!existsExact || !existsExactJs) && existsTs && file.endsWith('.js')) {
      tsRequiredFiles.push({ file: path.relative(__dirname, file), importPath, type, resolvedTs: path.relative(__dirname, resolvedBase + '.ts') });
    }
  };

  let match;
  while ((match = requireRegex.exec(content)) !== null) checkPath(match[1], 'require');
  while ((match = importRegex.exec(content)) !== null) checkPath(match[1], 'import');
  while ((match = dynamicImportRegex.exec(content)) !== null) checkPath(match[1], 'dynamic_import');
});

console.log("=== TS Files Required by JS ===");
console.log(JSON.stringify(tsRequiredFiles, null, 2));

console.log("\n=== Entirely Missing Requires ===");
console.log(JSON.stringify(missingCompletely, null, 2));
