import { spawn } from 'child_process';

console.log('Auto-pushing database schema...\n');

const drizzlePush = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let promptCount = 0;

drizzlePush.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  
  // Process each line
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    process.stdout.write(line + '\n');
    
    // Check if this is a prompt
    if (line.includes('create column') || line.includes('rename column') || 
        line.includes('create table') || line.includes('rename table')) {
      promptCount++;
      console.log(`\nAuto-answering prompt ${promptCount}: selecting option 1 (create)`);
      // Send '1' followed by Enter to select the first option
      setTimeout(() => {
        drizzlePush.stdin.write('1\n');
      }, 100);
    }
  }
  
  // Keep the last incomplete line in buffer
  buffer = lines[lines.length - 1];
});

drizzlePush.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

drizzlePush.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Database schema pushed successfully!');
  } else {
    console.log(`\n❌ Failed with code ${code}`);
  }
  process.exit(code);
});