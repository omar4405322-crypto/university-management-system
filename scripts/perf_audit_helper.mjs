import fs from 'node:fs';
import path from 'node:path';

const distDir = 'artifacts/university-app/dist/public/assets';
const files = fs.readdirSync(distDir);

const jsFiles = files.filter(f => f.endsWith('.js')).map(f => {
  const filePath = path.join(distDir, f);
  const stat = fs.statSync(filePath);
  return { name: f, size: stat.size, kb: (stat.size / 1024).toFixed(2) };
});

jsFiles.sort((a, b) => b.size - a.size);

console.log('Top 20 JS Chunks by size:');
for (const f of jsFiles.slice(0, 20)) {
  console.log(`${f.name.padEnd(45)}: ${f.kb.padStart(8)} KB`);
}

// Find index entry chunk
const indexChunk = jsFiles.find(f => f.name.startsWith('index-'));
if (indexChunk) {
  const content = fs.readFileSync(path.join(distDir, indexChunk.name), 'utf8');
  console.log('\nAnalyzing entry chunk:', indexChunk.name, 'Length:', content.length);

  // Check what large strings / translation dicts exist in entry
  const hasAr = content.includes('مدير النظام') || content.includes('التقدير الحرفي');
  const hasEn = content.includes('System Administrator') || content.includes('Letter Grade');
  console.log('Includes full Arabic dictionary in entry:', hasAr);
  console.log('Includes full English dictionary in entry:', hasEn);

  // Check for other libraries bundled directly in index
  const checks = [
    'framer-motion',
    'lucide',
    'socket.io-client',
    'react-hot-toast',
    'clsx',
    'tailwind-merge',
    'date-fns',
    'axios',
    'recharts',
    'radix',
    'i18next'
  ];
  for (const c of checks) {
    console.log(`Contains mention of ${c}:`, content.toLowerCase().includes(c.toLowerCase()));
  }
}
