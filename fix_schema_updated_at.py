import re

with open("src/db/schema.ts", "r") as f:
    content = f.read()

# Replace updatedAt: numeric().notNull() with updatedAt: numeric().default(sql`(CURRENT_TIMESTAMP)`).notNull()
content = re.sub(
    r"updatedAt: numeric\(\)\.notNull\(\)",
    r"updatedAt: numeric().default(sql`(CURRENT_TIMESTAMP)`).notNull()",
    content
)

with open("src/db/schema.ts", "w") as f:
    f.write(content)
