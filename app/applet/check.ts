const fs = require('fs');
const contents = fs.readFileSync('src/components/TabAdmin.tsx', 'utf8');
const lines = contents.split('\n');

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('.map(')) {
    const nextLines = lines.slice(Math.max(0, i-1), i+3).join(' ');
    // Search for JSX open tags
    if (nextLines.includes('<') && !nextLines.includes('key={') && !nextLines.includes('key=') && !nextLines.includes('<>') && nextLines.includes('=>')) {
       console.log('Line ' + (i + 1) + ': ' + l.trim());
    }
  }
}
