const fs = require('fs');
const path = 'c:\\Users\\omar4\\.gemini\\antigravity-ide\\brain\\12381b00-c4db-4a30-87a8-fbd1ca38103c\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(path, 'utf-8').trim().split('\n');
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('"type":"USER_INPUT"')) {
    fs.writeFileSync('last_user_request.txt', JSON.parse(lines[i]).content);
    break;
  }
}
