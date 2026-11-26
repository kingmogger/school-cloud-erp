import { spawn } from 'node:child_process';

console.log('==================================================');
console.log('🚀 Starting StudyX Full-Stack Platform...');
console.log('   - Backend API:  http://localhost:5001');
console.log('   - Frontend Web: http://localhost:5173');
console.log('   - Master Admin: http://localhost:5173/master-control/login');
console.log('==================================================\n');

const server = spawn('npm', ['--prefix', 'server', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

const client = spawn('npm', ['--prefix', 'client', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  try {
    server.kill();
    client.kill();
  } catch {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
