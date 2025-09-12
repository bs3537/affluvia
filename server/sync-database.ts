// Simple script to sync database with Drizzle schema
import { spawn } from 'child_process';

console.log('Syncing database schema with Drizzle...\n');

const drizzlePush = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  stdio: 'pipe'
});

let prompts = 0;

drizzlePush.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Auto-answer prompts by selecting option 1 (create column)
  if (output.includes('create column')) {
    prompts++;
    console.log(`\nAuto-selecting option 1 (create column) for prompt ${prompts}...`);
    drizzlePush.stdin.write('1\n');
  }
});

drizzlePush.stderr.on('data', (data) => {
  console.error(data.toString());
});

drizzlePush.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Database schema synced successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Register a new user');
    console.log('3. Fill out the intake form');
    console.log('4. View the dashboard');
  } else {
    console.log(`\n❌ Drizzle push failed with code ${code}`);
  }
  process.exit(code);
});