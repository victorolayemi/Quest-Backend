const fs = require('fs');

let mock = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/utils/prisma-mock.ts', 'utf8');
mock = mock.replace(/import \{ eq/g, 'import { getTableColumns } from "drizzle-orm";\nimport { eq');
mock = mock.replace(/\.\.\.sermonMedia,/g, '...getTableColumns(sermonMedia),');
mock = mock.replace(/with: \{ sermonMedia: true, userMedia: true \}/g, 'with: { sermonMedia: true }');
fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/utils/prisma-mock.ts', mock);

let media = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');
media = media.replace(/const prisma = getPrisma\(c\.env\.DB\);/g, 'const prisma: any = getPrisma(c.env.DB);');
fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', media);
