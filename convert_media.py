import re

with open("src/routes/media.ts", "r") as f:
    content = f.read()

# Just replace some basic stuff then I will manually edit if needed
content = content.replace("import { getPrisma } from \"../utils/prisma\";", "import { getDrizzle } from \"../utils/drizzle\";\nimport { eq, desc, asc, and, or, sql, lt, inArray, like } from 'drizzle-orm';\nimport { sermonMedia, userMedia, mediaLike, playProgress, user, subscription, appFeature, globalSettings } from '../db/schema';")
content = content.replace("getPrisma(c.env.DB)", "getDrizzle(c.env.DB)")
content = content.replace("const prisma = ", "const db = ")
content = content.replace("prisma:", "db:")
content = content.replace("checkAndDeductCoins(\n      c,\n      prisma,", "checkAndDeductCoins(\n      c,\n      db,")

with open("src/routes/media.ts", "w") as f:
    f.write(content)
