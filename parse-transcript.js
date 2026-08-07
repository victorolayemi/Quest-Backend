const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('/Users/victor/.gemini/antigravity-ide/brain/3586085c-3e1b-484a-bb34-20a60a08c764/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data.type === 'TOOL_RESPONSE') {
      const content = data.content || '';
      if (content.includes('File Path: `file:///Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts`') && content.includes('Created At: 2026-08-07T16:29')) {
        // We found the view_file output from the first step!
        const lines = content.split('\n');
        const sourceLines = [];
        let inCode = false;
        for (const l of lines) {
          if (l.match(/^\d+:/)) {
            const idx = l.indexOf(': ');
            if (idx !== -1) {
              sourceLines.push(l.substring(idx + 2));
            }
          }
        }
        if (sourceLines.length > 100) {
          fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', sourceLines.join('\n'));
          console.log(`Recovered media.ts with ${sourceLines.length} lines!`);
          process.exit(0);
        }
      }
    }
  } catch(e) {}
});

rl.on('close', () => {
  console.log('Finished reading transcript, no match found.');
});
