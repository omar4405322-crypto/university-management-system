const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
if (fs.existsSync(servicesDir)) {
  const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts') && f !== 'api.ts');

  files.forEach(file => {
    const filePath = path.join(servicesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    if (content.includes('apiRequest') && !content.includes('import { apiRequest }')) {
      content = `import { apiRequest } from '../lib/apiClient';\nimport type { ApiResponse } from '../types/models';\n` + content;
    }

    content = content.replace(/\(id\):/g, '(id: string):');
    content = content.replace(/\(id, data\):/g, '(id: string, data: Record<string, unknown>):');
    content = content.replace(/\(id, answers\):/g, '(id: string, answers: Record<string, unknown>):');
    content = content.replace(/\(q\):/g, '(q: string):');
    content = content.replace(/\(params = \{\}\):/g, '(params: Record<string, unknown> = {}):');
    
    // fix timetable.service.ts
    content = content.replace(/params: object = \{\}/g, 'params: Record<string, any> = {}');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
    }
  });
}

const utilsDir = path.join(__dirname, 'src', 'utils');
if (fs.existsSync(utilsDir)) {
  const exportCsvPath = path.join(utilsDir, 'exportCsv.ts');
  if (fs.existsSync(exportCsvPath)) {
    let content = fs.readFileSync(exportCsvPath, 'utf8');
    content = content.replace('filename, headers, rows', 'filename: string, headers: string[], rows: Record<string, any>[]');
    content = content.replace('const escapeCSV = (val) => {', 'const escapeCSV = (val: any) => {');
    content = content.replace('.map((row)', '.map((row: any)');
    fs.writeFileSync(exportCsvPath, content);
  }

  const maskEmailPath = path.join(utilsDir, 'maskEmail.ts');
  if (fs.existsSync(maskEmailPath)) {
    let content = fs.readFileSync(maskEmailPath, 'utf8');
    content = content.replace('maskEmail = (email)', 'maskEmail = (email: string)');
    fs.writeFileSync(maskEmailPath, content);
  }
}
