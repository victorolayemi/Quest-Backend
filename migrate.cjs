const fs = require('fs');

let content = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');

// Imports
content = content.replace(/import { getPrisma } from "..\/utils\/prisma";/g, 'import { getDrizzle } from "../utils/drizzle";');
content = content.replace(/import { user as userTable, sermonMedia, mediaLike, playProgress, subscription, userMedia, comment, commentReaction, user as _user } from "..\/db\/schema";/g, 'import { user as userTable, sermonMedia, mediaLike, playProgress, subscription, userMedia, comment, commentReaction, user as _user } from "../db/schema";\nimport { eq, desc, inArray, and, lt, like, sql } from "drizzle-orm";');

// Initialization
content = content.replace(/const prisma = getPrisma\(c\.env\.DB\);/g, 'const db = getDrizzle(c.env.DB);');

fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', content);
