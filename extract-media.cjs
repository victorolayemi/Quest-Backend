const fs = require('fs');

const transcriptPath = '/Users/victor/.gemini/antigravity-ide/brain/3586085c-3e1b-484a-bb34-20a60a08c764/.system_generated/logs/transcript_full.jsonl';
const rl = require('readline').createInterface({
  input: fs.createReadStream(transcriptPath),
  crlfDelay: Infinity
});

let lastContent = null;
let found = false;

rl.on('line', (line) => {
  try {
    const json = JSON.parse(line);
    if (json.tool_calls) {
      for (const call of json.tool_calls) {
        if (call.function === 'default_api:write_to_file' || call.function === 'default_api:multi_replace_file_content' || call.function === 'default_api:replace_file_content') {
           const args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
           if (args.TargetFile && args.TargetFile.endsWith('media.ts')) {
               lastContent = args;
           }
        }
      }
    }
  } catch(e) {}
});

rl.on('close', () => {
    if (lastContent) {
        console.log(JSON.stringify(lastContent, null, 2));
    } else {
        console.log("No media.ts edits found in transcript.");
    }
});
