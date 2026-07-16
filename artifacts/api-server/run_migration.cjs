const { spawn } = require('child_process');
const cp = spawn('npx.cmd', ['prisma', 'migrate', 'dev', '--name', 'remove_session_type'], { stdio: ['pipe', 'inherit', 'inherit'] });
cp.stdin.write('y\n');
cp.stdin.end();
