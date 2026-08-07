const fs = require('fs');

let content = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');

// Replace findUnique/findFirst
content = content.replace(/prisma\.sermonMedia\.findUnique\(\s*\{\s*where:\s*\{\s*id\s*:\s*cursor\s*\}\s*\}\s*\)/g, 'db.query.sermonMedia.findFirst({ where: eq(sermonMedia.id, cursor as string) })');
content = content.replace(/prisma\.userMedia\.findUnique\(\s*\{\s*where:\s*\{\s*id\s*:\s*cursor\s*\}\s*\}\s*\)/g, 'db.query.userMedia.findFirst({ where: eq(userMedia.id, cursor as string) })');

content = content.replace(/prisma\.sermonMedia\.findUnique\(\s*\{\s*where:\s*\{\s*id\s*\}\s*\}\s*\)/g, 'db.query.sermonMedia.findFirst({ where: eq(sermonMedia.id, id) })');
content = content.replace(/prisma\.userMedia\.findUnique\(\s*\{\s*where:\s*\{\s*id:\s*mediaId\s*\}\s*\}\s*\)/g, 'db.query.userMedia.findFirst({ where: eq(userMedia.id, mediaId) })');
content = content.replace(/prisma\.sermonMedia\.findUnique\(\s*\{\s*where:\s*\{\s*id:\s*mediaId\s*\}\s*\}\s*\)/g, 'db.query.sermonMedia.findFirst({ where: eq(sermonMedia.id, mediaId) })');

content = content.replace(/prisma\.mediaLike\.findFirst\(\s*\{\s*where:\s*\{\s*userId,\s*mediaId:\s*id,\s*\}\s*,\s*\}\s*\)/g, 'db.query.mediaLike.findFirst({ where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)) })');
content = content.replace(/prisma\.mediaLike\.findFirst\(\s*\{\s*where:\s*\{\s*userId,\s*mediaId:\s*id\s*\}\s*\}\s*\)/g, 'db.query.mediaLike.findFirst({ where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)) })');

content = content.replace(/prisma\.mediaLike\.delete\(\s*\{\s*where:\s*\{\s*id:\s*existingLike\.id\s*\}\s*\}\s*\)/g, 'db.delete(mediaLike).where(eq(mediaLike.id, existingLike.id))');
content = content.replace(/prisma\.mediaLike\.create\(\s*\{\s*data:\s*\{\s*userId,\s*mediaId:\s*id\s*,?\s*\}\s*\}\s*\)/g, 'db.insert(mediaLike).values({ userId, mediaId: id }).returning()');

content = content.replace(/prisma\.playProgress\.findFirst\(\s*\{\s*where:\s*\{\s*userId,\s*mediaId\s*\}\s*\}\s*\)/g, 'db.query.playProgress.findFirst({ where: and(eq(playProgress.userId, userId), eq(playProgress.mediaId, mediaId as string)) })');

content = content.replace(/prisma\.playProgress\.update\(\s*\{\s*where:\s*\{\s*id:\s*existing\.id\s*\}\s*,\s*data:\s*\{\s*progressSeconds:\s*progressSeconds\s*\?\?\s*0,\s*completed:\s*completed\s*\?\?\s*false\s*,?\s*\}\s*,?\s*\}\s*\)/g, 'db.update(playProgress).set({ progressSeconds: progressSeconds ?? 0, completed: completed ?? false }).where(eq(playProgress.id, existing.id)).returning()');

content = content.replace(/prisma\.playProgress\.update\(\s*\{\s*where:\s*\{\s*id:\s*existing\.id\s*\}\s*,\s*data:\s*\{\s*progressSeconds,\s*completed\s*\}\s*,?\s*\}\s*\)/g, 'db.update(playProgress).set({ progressSeconds, completed }).where(eq(playProgress.id, existing.id)).returning()');

content = content.replace(/prisma\.playProgress\.create\(\s*\{\s*data:\s*\{\s*userId,\s*mediaId:\s*mediaId\s*as\s*string,\s*progressSeconds:\s*progressSeconds\s*\?\?\s*0,\s*completed:\s*completed\s*\?\?\s*false\s*,?\s*\}\s*,\s*\}\s*\)/g, 'db.insert(playProgress).values({ userId, mediaId: mediaId as string, progressSeconds: progressSeconds ?? 0, completed: completed ?? false }).returning()');

content = content.replace(/prisma\.playProgress\.create\(\s*\{\s*data:\s*\{\s*userId,\s*mediaId:\s*mediaId\s*as\s*string,\s*progressSeconds,\s*completed\s*,?\s*\}\s*,\s*\}\s*\)/g, 'db.insert(playProgress).values({ userId, mediaId: mediaId as string, progressSeconds, completed }).returning()');

content = content.replace(/prisma\.user\.update\(\s*\{\s*where:\s*\{\s*id:\s*userId\s*\}\s*,\s*data:\s*\{\s*points:\s*\{\s*increment:\s*20\s*\}\s*,\s*videoReelPoints:\s*\{\s*increment:\s*20\s*\}\s*,?\s*\}\s*,\s*\}\s*\)/g, 'db.update(userTable).set({ points: sql`points + 20`, videoReelPoints: sql`videoReelPoints + 20` }).where(eq(userTable.id, userId)).returning()');

content = content.replace(/prisma\.user\.update\(\s*\{\s*where:\s*\{\s*id:\s*userId\s*\}\s*,\s*data:\s*\{\s*points:\s*\{\s*increment:\s*20\s*\}\s*,\s*audioReelPoints:\s*\{\s*increment:\s*20\s*\}\s*,?\s*\}\s*,\s*\}\s*\)/g, 'db.update(userTable).set({ points: sql`points + 20`, audioReelPoints: sql`audioReelPoints + 20` }).where(eq(userTable.id, userId)).returning()');

content = content.replace(/prisma\.userMedia\.delete\(\s*\{\s*where:\s*\{\s*id:\s*mediaId\s*\}\s*\}\s*\)/g, 'db.delete(userMedia).where(eq(userMedia.id, mediaId))');

content = content.replace(/prisma\.userMedia\.count\(\s*\{\s*where:\s*\{\s*userId\s*\}\s*\}\s*\)/g, 'db.select({ count: sql<number>`count(*)` }).from(userMedia).where(eq(userMedia.userId, userId)).then(res => res[0].count)');

content = content.replace(/prisma\.mediaLike\.count\(\s*\{\s*where:\s*\{\s*mediaId:\s*record\.mediaId\s*\}\s*,\s*\}\s*\)/g, 'db.select({ count: sql<number>`count(*)` }).from(mediaLike).where(eq(mediaLike.mediaId, record.mediaId)).then(res => res[0].count)');

fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', content);
