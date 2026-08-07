import re

with open("src/routes/users.ts", "r") as f:
    content = f.read()

# Replace imports
content = content.replace("import { getPrisma } from '../utils/prisma';", "import { getDrizzle } from '../utils/drizzle';\nimport { user as userTable, friendRequest as friendRequestTable, earnedBadge as earnedBadgeTable, communityMember as communityMemberTable } from '../db/schema';\nimport { eq, or, and, inArray } from 'drizzle-orm';")

# Users GET /me
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: userId \},\s*include: \{\s*currentFeeling: true\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId), with: { currentFeeling: true } });',
    content
)

# Users PUT /me
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const updated = await prisma\.user\.update\(\{\s*where: \{ id: userId \},\s*data: \{\s*firstName: firstName \|\| void 0,\s*lastName: lastName \|\| void 0,\s*gender: gender \|\| void 0,\s*location: location \|\| void 0\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const updatedArr = await db.update(userTable).set({ firstName: firstName || undefined, lastName: lastName || undefined, gender: gender || undefined, location: location || undefined }).where(eq(userTable.id, userId)).returning();\n  const updated = updatedArr[0];',
    content
)

# Users PUT /me/avatar
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*(.*?)const updatedUser = await prisma\.user\.update\(\{\s*where: \{ id: userId \},\s*data: \{\s*avatarUrl\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  \1const updatedUserArr = await db.update(userTable).set({ avatarUrl }).where(eq(userTable.id, userId)).returning();\n  const updatedUser = updatedUserArr[0];',
    content,
    flags=re.DOTALL
)

# Users PUT /me/bio
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const updated = await prisma\.user\.update\(\{\s*where: \{ id: userId \},\s*data: \{\s*bio\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const updatedArr = await db.update(userTable).set({ bio }).where(eq(userTable.id, userId)).returning();\n  const updated = updatedArr[0];',
    content
)

# Users PUT /me/settings
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const updated = await prisma\.user\.update\(\{\s*where: \{ id: userId \},\s*data: \{(.*?)\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const updatedArr = await db.update(userTable).set({\1}).where(eq(userTable.id, userId)).returning();\n  const updated = updatedArr[0];',
    content,
    flags=re.DOTALL
)

# Users PATCH /me/fcm-token
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*try \{\s*const \{ fcmToken \} = await c\.req\.json\(\);\s*if \(\!fcmToken\) return c\.json\(\{ error: "fcmToken is required" \}, 400\);\s*const updatedUser = await prisma\.user\.update\(\{\s*where: \{ id: userId \},\s*data: \{\s*fcmToken\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  try {\n    const { fcmToken } = await c.req.json();\n    if (!fcmToken) return c.json({ error: "fcmToken is required" }, 400);\n    const updatedUserArr = await db.update(userTable).set({ fcmToken }).where(eq(userTable.id, userId)).returning();',
    content
)

# Users GET /me/metrics
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: userId \},\s*include: \{\s*quizAttempts: true,\s*dailyBreadAttempts: true,\s*earnedBadges: true\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId), with: { quizAttempts: true, dailyBreadAttempts: true, earnedBadges: true } });',
    content
)

# Users GET /me/points
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: userId \}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId) });',
    content
)

# Users GET /:userId
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: targetUserId \},\s*select: \{\s*(.*?)\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, targetUserId), with: { currentFeeling: true }, columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, bio: true, points: true, streakCount: true, createdAt: true } });',
    content,
    flags=re.DOTALL
)

# Users GET /:userId/metrics
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const user = await prisma\.user\.findUnique\(\{\s*where: \{ id: targetUserId \},\s*include: \{\s*earnedBadges: true\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, targetUserId), with: { earnedBadges: true } });',
    content
)

# Users GET /:userId/profile-stats
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*const friendsCount = await prisma\.friendRequest\.count\(\{\s*where: \{\s*status: "ACCEPTED",\s*OR: \[\s*\{ senderId: targetUserId \},\s*\{ receiverId: targetUserId \}\s*\]\s*\}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  const friendsCountObj = await db.select({ count: sql`count(*)` }).from(friendRequestTable).where(and(eq(friendRequestTable.status, "ACCEPTED"), or(eq(friendRequestTable.senderId, targetUserId), eq(friendRequestTable.receiverId, targetUserId))));\n  const friendsCount = friendsCountObj[0].count;',
    content
)
content = re.sub(
    r'const badgesCount = await prisma\.earnedBadge\.count\(\{\s*where: \{ userId: targetUserId \}\s*\}\);',
    r'const badgesCountObj = await db.select({ count: sql`count(*)` }).from(earnedBadgeTable).where(eq(earnedBadgeTable.userId, targetUserId));\n  const badgesCount = badgesCountObj[0].count;',
    content
)
content = re.sub(
    r'const communitiesCount = await prisma\.communityMember\.count\(\{\s*where: \{ userId: targetUserId \}\s*\}\);',
    r'const communitiesCountObj = await db.select({ count: sql`count(*)` }).from(communityMemberTable).where(eq(communityMemberTable.userId, targetUserId));\n  const communitiesCount = communitiesCountObj[0].count;',
    content
)
content = re.sub(
    r'const targetUserCommunities = await prisma\.communityMember\.findMany\(\{\s*where: \{ userId: targetUserId \},\s*select: \{ communityId: true \}\s*\}\);',
    r'const targetUserCommunities = await db.query.communityMember.findMany({ where: (cm, { eq }) => eq(cm.userId, targetUserId), columns: { communityId: true } });',
    content
)
content = re.sub(
    r'const mutualCommunitiesMembers = await prisma\.communityMember\.findMany\(\{\s*where: \{\s*userId: currentUserId,\s*communityId: \{ in: targetCommunityIds \}\s*\},\s*include: \{\s*community: true\s*\}\s*\}\);',
    r'const mutualCommunitiesMembers = targetCommunityIds.length > 0 ? await db.query.communityMember.findMany({ where: (cm, { and, eq, inArray }) => and(eq(cm.userId, currentUserId), inArray(cm.communityId, targetCommunityIds)), with: { community: true } }) : [];',
    content
)
content = re.sub(
    r'const friendRequest = await prisma\.friendRequest\.findFirst\(\{\s*where: \{\s*OR: \[\s*\{ senderId: currentUserId, receiverId: targetUserId \},\s*\{ senderId: targetUserId, receiverId: currentUserId \}\s*\]\s*\}\s*\}\);',
    r'const friendRequest = await db.query.friendRequest.findFirst({ where: (fr, { or, and, eq }) => or(and(eq(fr.senderId, currentUserId), eq(fr.receiverId, targetUserId)), and(eq(fr.senderId, targetUserId), eq(fr.receiverId, currentUserId))) });',
    content
)

# Users DELETE /me
content = re.sub(
    r'const prisma = getPrisma\(c\.env\.DB\);\s*await prisma\.user\.delete\(\{\s*where: \{ id: userId \}\s*\}\);',
    r'const db = getDrizzle(c.env.DB);\n  await db.delete(userTable).where(eq(userTable.id, userId));',
    content
)

# Add missing sql import
content = content.replace("inArray } from 'drizzle-orm';", "inArray, sql } from 'drizzle-orm';")

with open("src/routes/users.ts", "w") as f:
    f.write(content)
