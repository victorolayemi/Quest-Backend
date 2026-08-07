import fs from 'fs';

let content = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');

if (!content.includes('import { eq')) {
    content = 'import { eq, desc, inArray, and, lt, like, sql } from "drizzle-orm";\nimport { user as userTable, sermonMedia, mediaLike, playProgress, subscription, userMedia, comment, commentReaction, globalSettings, appFeature } from "../db/schema";\n' + content;
}

content = content.replace(/prisma\.sermonMedia\.findMany\(\s*\{\s*where:\s*\{([\s\S]*?)\},\s*orderBy:\s*\{\s*createdAt:\s*"desc"\s*\},\s*take:\s*(.*?),\s*include:\s*\{\s*_count:\s*\{\s*select:\s*\{\s*mediaLikes:\s*true\s*\}\s*\}\s*\}\s*,?\s*\}\)/g, 
  'db.query.sermonMedia.findMany({ where: (sermonMedia, { and, ilike, lt, eq }) => and($1.type ? eq(sermonMedia.type, $1.type) : undefined, $1.createdAt ? lt(sermonMedia.createdAt, $1.createdAt.lt) : undefined, $1.title ? ilike(sermonMedia.title, `%${$1.title.contains}%`) : undefined), orderBy: [desc(sermonMedia.createdAt)], limit: $2, extras: { mediaLikes: sql<number>`(select count(*) from ${mediaLike} where ${mediaLike.mediaId} = ${sermonMedia.id})`.as("mediaLikes") } })'
);

content = content.replace(/prisma\.userMedia\.findMany\(\s*\{\s*where:\s*\{([\s\S]*?)\},\s*orderBy:\s*\{\s*createdAt:\s*"desc"\s*\},\s*take:\s*(.*?),\s*include:\s*\{\s*user:\s*true\s*\}\s*,?\s*\}\)/g, 
  'db.query.userMedia.findMany({ where: (userMedia, { and, ilike, lt, eq }) => and($1.type ? eq(userMedia.type, $1.type) : undefined, $1.createdAt ? lt(userMedia.createdAt, $1.createdAt.lt) : undefined, $1.title ? ilike(userMedia.title, `%${$1.title.contains}%`) : undefined, $1.userId ? eq(userMedia.userId, $1.userId) : undefined), orderBy: [desc(userMedia.createdAt)], limit: $2, with: { user: true } })'
);

content = content.replace(/prisma\.mediaLike\.findMany\(\s*\{\s*where:\s*\{\s*userId,\s*mediaId:\s*\{\s*in:\s*allIds\s*\}\s*\}\s*,\s*select:\s*\{\s*mediaId:\s*true\s*\}\s*,\s*\}\)/g, 
  'db.select({ mediaId: mediaLike.mediaId }).from(mediaLike).where(and(eq(mediaLike.userId, userId), inArray(mediaLike.mediaId, allIds)))'
);

content = content.replace(/prisma\.playProgress\.findMany\(\s*\{\s*where:\s*\{\s*userId,\s*completed:\s*false\s*,\s*\}\s*,\s*orderBy:\s*\{\s*updatedAt:\s*"desc"\s*\}\s*,\s*include:\s*\{\s*media:\s*true\s*,\s*\}\s*,\s*take:\s*20\s*,\s*\}\)/g, 
  'db.query.playProgress.findMany({ where: and(eq(playProgress.userId, userId), eq(playProgress.completed, false)), orderBy: [desc(playProgress.updatedAt)], limit: 20, with: { sermonMedia: true } })'
);

content = content.replace(/prisma\.subscription\.findFirst\(\s*\{\s*where:\s*\{\s*userId,\s*status:\s*"active",\s*expiresAt:\s*\{\s*gt:\s*new Date\(\)\s*\}\s*\}\s*,?\s*\}\)/g, 
  'db.query.subscription.findFirst({ where: and(eq(subscription.userId, userId), eq(subscription.status, "active"), sql`${subscription.expiresAt} > CURRENT_TIMESTAMP`) })'
);

content = content.replace(/prisma\.appFeature\.findUnique\(\s*\{\s*where:\s*\{\s*key:\s*"free_media_posts_limit"\s*\}\s*\}\)/g, 
  'db.query.appFeature.findFirst({ where: eq(appFeature.key, "free_media_posts_limit") })'
);

content = content.replace(/prisma\.globalSettings\.findUnique\(\s*\{\s*where:\s*\{\s*id:\s*"default"\s*\}\s*\}\)/g, 
  'db.query.globalSettings.findFirst({ where: eq(globalSettings.id, "default") })'
);

content = content.replace(/prisma\.user\.findUnique\(\s*\{\s*where:\s*\{\s*id:\s*userId\s*\}\s*,\s*select:\s*\{\s*isBanned:\s*true,\s*mediaRestrictionExpiry:\s*true\s*\}\s*,\s*\}\)/g, 
  'db.query.user.findFirst({ where: eq(userTable.id, userId), columns: { isBanned: true, mediaRestrictionExpiry: true } })'
);

content = content.replace(/prisma\.userMedia\.create\(\s*\{\s*data:\s*\{\s*userId,\s*title:\s*title\s*as\s*string,\s*mediaUrl:\s*fileUrl,\s*imageUrl,\s*type:\s*type\s*as\s*string\s*,?\s*\}\s*,?\s*\}\)/g, 
  'db.insert(userMedia).values({ userId, title: title as string, mediaUrl: fileUrl, imageUrl, type: type as string }).returning()'
);

content = content.replace(/prisma\.userMedia\.findMany\(\s*\{\s*where:\s*\{\s*userId\s*\}\s*,\s*orderBy:\s*\{\s*createdAt:\s*"desc"\s*\}\s*,?\s*\}\)/g, 
  'db.query.userMedia.findMany({ where: eq(userMedia.userId, userId), orderBy: [desc(userMedia.createdAt)] })'
);

content = content.replace(/prisma\.userMedia\.update\(\s*\{\s*where:\s*\{\s*id:\s*mediaId\s*\}\s*,\s*data:\s*\{\s*title:\s*reqData\.title\s*!==\s*undefined\s*\?\s*reqData\.title\s*:\s*existingMedia\.title\s*,?\s*\}\s*,?\s*\}\)/g, 
  'db.update(userMedia).set({ title: reqData.title !== undefined ? reqData.title : existingMedia.title }).where(eq(userMedia.id, mediaId)).returning()'
);

content = content.replace(/prisma\./g, 'db.query.'); // Fallback

fs.writeFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', content);
console.log("Migration applied");
