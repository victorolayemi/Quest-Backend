const fs = require('fs');

let content = fs.readFileSync('src/routes/friends.ts', 'utf8');

// Replace getPrisma with getDrizzle
content = content.replace("import { getPrisma } from '../utils/prisma';", "import { getDrizzle } from '../db';\nimport { eq, or, and, sql, inArray, desc } from 'drizzle-orm';\nimport { friendRequest, user, userFeeling, affirmation } from '../db/schema';");
content = content.replace(/getPrisma/g, 'getDrizzle');
content = content.replace(/const prisma = getDrizzle\(c\.env\.DB\);/g, 'const db = getDrizzle(c.env.DB);');

// Manual fixes for specific endpoints
content = content.replace(/prisma/g, 'db');

fs.writeFileSync('src/routes/friends.ts.tmp', content);
