const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/omar4/Desktop/University management system/frontend/src/pages/teaching-assistants';
const files = fs.readdirSync(dir);

files.forEach(file => {
  let p = path.join(dir, file);
  if (!p.endsWith('.tsx')) return;
  let content = fs.readFileSync(p, 'utf8');
  
  content = content.replace(/Doctor/g, 'TeachingAssistant');
  content = content.replace(/doctor/g, 'teachingAssistant');
  content = content.replace(/doctors/g, 'teachingAssistants'); // URLs might use teaching-assistants though, handle below
  content = content.replace(/Doctors/g, 'TeachingAssistants');
  content = content.replace(/الدكاترة/g, 'المعيدين');
  content = content.replace(/دكتور/g, 'معيد');
  content = content.replace(/الدكتور/g, 'المعيد');
  content = content.replace(/أطباء/g, 'معيدين');
  
  // Fix endpoint URLs
  content = content.replace(/\/api\/teachingAssistants/g, '/api/teaching-assistants');
  
  // Fix properties
  content = content.replace(/teachingAssistantId/g, 'specialization'); 
  content = content.replace(/رقم المعيد/g, 'التخصص');
  
  content = content.replace(/teachingAssistant\.firstName/g, "(teachingAssistant.user?.email || '').split('@')[0]");
  content = content.replace(/teachingAssistant\.lastName/g, "''");
  
  fs.writeFileSync(p, content);
});
console.log('Done replacing strings in teaching-assistants pages');
