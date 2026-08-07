import re

with open("src/db/schema.ts", "r") as f:
    content = f.read()

# Replace integer({ mode: 'boolean' }).notNull() with integer({ mode: 'boolean' }).default(false).notNull()
# Only if it doesn't already have .default
content = re.sub(
    r"integer\(\{ mode: 'boolean' \}\)\.notNull\(\)",
    r"integer({ mode: 'boolean' }).default(false).notNull()",
    content
)

# Also handle if it has column name: integer("...", { mode: 'boolean' }).notNull()
content = re.sub(
    r"integer\(([^)]*), \{ mode: 'boolean' \}\)\.notNull\(\)",
    r"integer(\1, { mode: 'boolean' }).default(false).notNull()",
    content
)

with open("src/db/schema.ts", "w") as f:
    f.write(content)
