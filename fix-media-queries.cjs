const fs = require('fs');

let content = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');

// Replacements
content = content.replace(/prisma\.sermonMedia\.findUnique\(\{[\s\n]*where: \{ id(:\s*cursor)? \}[\s\n]*\}\)/g, 'db.query.sermonMedia.findFirst({ where: eq(sermonMedia.id, $1 ? cursor : id) })');
content = content.replace(/prisma\.userMedia\.findUnique\(\{[\s\n]*where: \{ id(:\s*cursor)? \}[\s\n]*\}\)/g, 'db.query.userMedia.findFirst({ where: eq(userMedia.id, $1 ? cursor : id) })');

fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', content);
