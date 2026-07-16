import fs from 'fs';
import path from 'path';

const searchTerms = [
  'sessionType',
  'SessionType',
  'SEMINAR',
  'TUTORIAL'
];

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace SessionType -> SlotType
  content = content.replace(/SessionType/g, 'SlotType');
  // Replace sessionType -> slotType
  content = content.replace(/sessionType/g, 'slotType');
  
  // Replace SEMINAR/TUTORIAL with SECTION where it was used as an enum value
  // This is a bit tricky, but mostly 'SEMINAR' -> 'SECTION' and 'TUTORIAL' -> 'SECTION'
  content = content.replace(/'SEMINAR'/g, "'SECTION'");
  content = content.replace(/'TUTORIAL'/g, "'SECTION'");
  content = content.replace(/"SEMINAR"/g, '"SECTION"');
  content = content.replace(/"TUTORIAL"/g, '"SECTION"');
  
  // Also lower case strings for i18n keys
  content = content.replace(/schedule\.seminar/g, 'schedule.section');
  content = content.replace(/schedule\.tutorial/g, 'schedule.section');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.json')) {
      replaceInFile(fullPath);
    }
  }
}

walk('src');
