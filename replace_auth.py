import re

with open("src/routes/auth.ts", "r") as f:
    content = f.read()

# Replace imports
content = content.replace("import { getPrisma } from '../utils/prisma';", "import { getDrizzle } from '../utils/drizzle';\nimport { user, globalSettings, otpRequest, loginHistory } from '../db/schema';\nimport { eq, or, and, gte, desc } from 'drizzle-orm';")

# Replace getPrisma
content = content.replace("const prisma = getPrisma(c.env.DB);", "const db = getDrizzle(c.env.DB);")

# Replace guest creation
content = re.sub(
    r'const guestUser = await prisma\.user\.create\(\{\s*data: \{\s*isGuest: true,\s*points: 0,\s*streakCount: 0\s*\}\s*\}\);',
    r'const guestUserArr = await db.insert(user).values({ id: crypto.randomUUID(), isGuest: 1, points: 0, streakCount: 0 }).returning();\n  const guestUser = guestUserArr[0];',
    content
)

# Replace guest check
content = re.sub(
    r'const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: userId \}\s*\}\);',
    r'const user = await db.query.user.findFirst({ where: (users, { eq }) => eq(users.id, userId) });',
    content
)

# Replace globalSettings findUnique
content = re.sub(
    r'await prisma\.globalSettings\.findUnique\(\{\s*where: \{\s*id: "default"\s*\}\s*\}\)',
    r'await db.query.globalSettings.findFirst({ where: (s, { eq }) => eq(s.id, "default") })',
    content
)

# Replace otpRequest create
content = re.sub(
    r'await prisma\.otpRequest\.create\(\{\s*data: \{\s*contact,\s*code,\s*expiresAt\s*\}\s*\}\);',
    r'await db.insert(otpRequest).values({ id: crypto.randomUUID(), contact, code, expiresAt: expiresAt.toISOString() });',
    content
)

# Replace otpRequest findFirst
content = re.sub(
    r'const otpRequest = await prisma\.otpRequest\.findFirst\(\{\s*where: \{\s*contact,\s*code,\s*expiresAt: \{ gte: new Date\(\) \},\s*verified: false\s*\},\s*orderBy: \{ expiresAt: "desc" \}\s*\}\);',
    r'const otpRequest = await db.query.otpRequest.findFirst({ where: (o, { eq, and, gte }) => and(eq(o.contact, contact), eq(o.code, code), eq(o.verified, 0), gte(o.expiresAt, new Date().toISOString())), orderBy: (o, { desc }) => [desc(o.expiresAt)] });',
    content
)

content = re.sub(
    r'const otpRequest = await prisma\.otpRequest\.findFirst\(\{\s*where: \{\s*contact,\s*code,\s*expiresAt: \{ gte: /\* @__PURE__ \*/ new Date\(\) \},\s*verified: false\s*\},\s*orderBy: \{ expiresAt: "desc" \}\s*\}\);',
    r'const otpRequest = await db.query.otpRequest.findFirst({ where: (o, { eq, and, gte }) => and(eq(o.contact, contact), eq(o.code, code), eq(o.verified, 0), gte(o.expiresAt, new Date().toISOString())), orderBy: (o, { desc }) => [desc(o.expiresAt)] });',
    content
)

# Replace otpRequest update
content = re.sub(
    r'await prisma\.otpRequest\.update\(\{\s*where: \{ id: otpRequest\.id \},\s*data: \{ verified: true \}\s*\}\);',
    r'await db.update(otpRequest).set({ verified: 1 }).where(eq(otpRequest.id, otpRequest.id));',
    content
)

# Replace user findUnique username
content = re.sub(
    r'const existingUsername = await prisma\.user\.findUnique\(\{\s*where: \{ username \}\s*\}\);',
    r'const existingUsername = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.username, username) });',
    content
)

# Replace user findFirst OR
content = re.sub(
    r'const existingUser = await prisma\.user\.findFirst\(\{\s*where: \{\s*OR: \[\s*\{ email: contact \},\s*\{ phoneNumber: contact \}\s*\]\s*\}\s*\}\);',
    r'const existingUser = await db.query.user.findFirst({ where: (u, { or, eq }) => or(eq(u.email, contact), eq(u.phoneNumber, contact)) });',
    content
)
content = re.sub(
    r'const user = await prisma\.user\.findFirst\(\{\s*where: \{\s*OR: \[\s*\{ email: contact \},\s*\{ phoneNumber: contact \}\s*\]\s*\}\s*\}\);',
    r'const user = await db.query.user.findFirst({ where: (u, { or, eq }) => or(eq(u.email, contact), eq(u.phoneNumber, contact)) });',
    content
)
content = re.sub(
    r'const user = await prisma\.user\.findFirst\(\{\s*where: \{ email: verifiedEmail \}\s*\}\);',
    r'const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, verifiedEmail) });',
    content
)
content = re.sub(
    r'let user = await prisma\.user\.findUnique\(\{\s*where: \{ email \}\s*\}\);',
    r'let user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) });',
    content
)

# Replace user update guest
content = re.sub(
    r'user = await prisma\.user\.update\(\{\s*where: \{ id: existingUser\.id \},\s*data: \{\s*isGuest: false,\s*email: contact\.includes\("@"\) \? contact : null,\s*phoneNumber: contact\.includes\("@"\) \? null : contact,\s*password: hashedPassword,\s*firstName,\s*lastName,\s*username,\s*gender\s*\}\s*\}\);',
    r'const userArr = await db.update(user).set({ isGuest: 0, email: contact.includes("@") ? contact : null, phoneNumber: contact.includes("@") ? null : contact, password: hashedPassword, firstName, lastName, username, gender }).where(eq(user.id, existingUser.id)).returning();\n    user = userArr[0];',
    content
)

# Replace user create non-guest
content = re.sub(
    r'user = await prisma\.user\.create\(\{\s*data: \{\s*email: contact\.includes\("@"\) \? contact : null,\s*phoneNumber: contact\.includes\("@"\) \? null : contact,\s*password: hashedPassword,\s*isGuest: false,\s*firstName,\s*lastName,\s*username,\s*gender\s*\}\s*\}\);',
    r'const userArr = await db.insert(user).values({ id: crypto.randomUUID(), email: contact.includes("@") ? contact : null, phoneNumber: contact.includes("@") ? null : contact, password: hashedPassword, isGuest: 0, firstName, lastName, username, gender }).returning();\n    user = userArr[0];',
    content
)

# Replace Google/Apple user create
content = re.sub(
    r'user = await prisma\.user\.create\(\{\s*data: \{\s*email,\s*firstName,\s*lastName,\s*isGuest: false\s*\}\s*\}\);',
    r'const userArr = await db.insert(user).values({ id: crypto.randomUUID(), email, firstName, lastName, isGuest: 0 }).returning();\n    user = userArr[0];',
    content
)
content = re.sub(
    r'user = await prisma\.user\.create\(\{\s*data: \{\s*email: verifiedEmail,\s*isGuest: false\s*\}\s*\}\);',
    r'const userArr = await db.insert(user).values({ id: crypto.randomUUID(), email: verifiedEmail, isGuest: 0 }).returning();\n    user = userArr[0];',
    content
)

# Replace user password update
content = re.sub(
    r'await prisma\.user\.update\(\{\s*where: \{ id: user\.id \},\s*data: \{ password: upgradedHash \}\s*\}\);',
    r'await db.update(user).set({ password: upgradedHash }).where(eq(user.id, user.id));',
    content
)
content = re.sub(
    r'await prisma\.user\.update\(\{\s*where: \{ id: user\.id \},\s*data: \{ password: hashedPassword \}\s*\}\);',
    r'await db.update(user).set({ password: hashedPassword }).where(eq(user.id, user.id));',
    content
)

# Replace loginHistory create
content = re.sub(
    r'await prisma\.loginHistory\.create\(\{\s*data: \{\s*userId: user\.id,\s*ip,\s*browser,\s*os\s*\}\s*\}\);',
    r'await db.insert(loginHistory).values({ id: crypto.randomUUID(), userId: user.id, ip, browser, os });',
    content
)

with open("src/routes/auth_new.ts", "w") as f:
    f.write(content)
