const fs = require('fs');

const files = [
  'src/routes/communities/messages.ts',
  'src/routes/communities/posts.ts',
  'src/routes/communities/verse.ts',
  'src/routes/communities/core.ts',
  'src/routes/communities/events.ts',
  'src/routes/communities/forum.ts',
  'src/routes/communities/members.ts'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/new Date\(\)/g, "new Date().toISOString()");
    content = content.replace(/eq\(\w+\.userId, userId\)/g, "eq($&, userId as string)".replace('$&', '$$&')); // Not doing this via regex to be safe.
    fs.writeFileSync(file, content);
  }
}
console.log('Fixed dates!');
