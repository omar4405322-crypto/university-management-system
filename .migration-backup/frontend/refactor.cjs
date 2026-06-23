const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts') && f !== 'api.ts');

let totalTryCatchRemoved = 0;
let modifiedFiles = [];

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // regex for simple format without try/catch:
  // methodName: async (args) => {
  //   const response = await api.METHOD(ARGS);
  //   return response.data;
  // },
  const regexSimple = /(?:async\s+)?(\([^)]*\))\s*=>\s*\{\s*(?:const\s+[\w]+\s*=\s*)?await\s+(api\.[a-zA-Z0-9_]+\([^;]+(?:\);|;)?)\s*(?:return\s+[\w]+\.data;?|return\s+[\w]+;?)\s*\}/g;

  content = content.replace(regexSimple, (match, args, apiCall) => {
    apiCall = apiCall.trim().replace(/;$/, '');
    return `(${args}): Promise<ApiResponse<any>> => apiRequest(() => ${apiCall})`;
  });

  // some files might just return await api.get()
  // methodName: async (args) => {
  //   return await api.get(ARGS);
  // }
  const regexReturnAwait = /(?:async\s+)?(\([^)]*\))\s*=>\s*\{\s*return\s+await\s+(api\.[a-zA-Z0-9_]+\([^;]+(?:\);|;)?)\s*\}/g;

  content = content.replace(regexReturnAwait, (match, args, apiCall) => {
    apiCall = apiCall.trim().replace(/;$/, '');
    return `(${args}): Promise<ApiResponse<any>> => apiRequest(() => ${apiCall})`;
  });

  if (content !== originalContent) {
    if (!content.includes('apiRequest')) {
      content = `import { apiRequest } from '../lib/apiClient';\nimport type { ApiResponse } from '../types/models';\n` + content;
    }
    fs.writeFileSync(filePath, content);
    modifiedFiles.push(file);
  }
});

console.log(JSON.stringify({ modifiedFiles, additionalModifications: true }));
