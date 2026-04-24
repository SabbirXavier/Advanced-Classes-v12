const fs = require('fs');
const contents = fs.readFileSync('src/components/TabAdmin.tsx', 'utf8');
const lines = contents.split('\n');

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('.map(') && l.includes('=> (')) {
    const nextLines = lines.slice(i, i+3).join(' ');
    if (nextLines.includes('<') && !nextLines.includes('key={') && !nextLines.includes('key=') && !nextLines.includes('<>')) {
       console.log('Line ' + (i + 1) + ': ' + l.trim());
    }
  }
}
