const fs = require('fs');

const path = 'c:/Users/omar4/Desktop/University management system/artifacts/api-server/src/controllers/user.controller.ts';
let content = fs.readFileSync(path, 'utf8');

// The file has a duplicate block that includes getAllUsers, createAdmin, deleteUser, hardDeleteUser, etc.
// We can just parse the file and keep only the last occurrence of each export block.
// Let's split by "export const "
const parts = content.split('export const ');

const firstPart = parts.shift();
const exportsMap = new Map();
const exportOrder = [];

for (const part of parts) {
  const name = part.split(' =')[0].trim();
  if (!exportsMap.has(name)) {
    exportOrder.push(name);
  }
  exportsMap.set(name, part);
}

// Reconstruct
let newContent = firstPart;
for (const name of exportOrder) {
  newContent += 'export const ' + exportsMap.get(name);
}

fs.writeFileSync(path, newContent);
console.log('Fixed duplicates');
