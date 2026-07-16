const { spawn } = require('child_process');
const p = spawn('npx.cmd', ['prisma', 'migrate', 'dev', '--name', 'phase1_scheduling_rebuild', '--create-only'], { shell: true });
p.stdout.on('data', d => {
  process.stdout.write(d.toString());
  if (d.toString().includes('y/N')) {
    p.stdin.write('y\n');
  }
});
p.stderr.on('data', d => process.stderr.write(d.toString()));
p.on('close', c => console.log('Exited with ' + c));
