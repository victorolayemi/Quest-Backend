const fs = require('fs');

const code = `import { Hono } from 'hono';
import { getDb } from '../../utils/drizzle';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';
import { community, communityDailyVerse, communityDailyVerseLike } from '../../db/schema';
import { eq, or, and, not, like, sql, inArray, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

app.get("/:id/verse-today", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const db = getDb(c.env.DB);
  
  const comRes = await db.query.community.findFirst({ where: eq(community.id, communityId) });
  if (!comRes) return c.json({ error: "Community not found" }, 404);
  
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let verse = await db.query.communityDailyVerse.findFirst({
    where: and(eq(communityDailyVerse.communityId, communityId), eq(communityDailyVerse.date, todayStr))
  });
  
  if (!verse) {
    const verses = [
      { reference: "John 3:16", text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.", explanation: "A reflection on God’s boundless love and the gift of eternal life." },
      { reference: "Philippians 4:13", text: "I can do all things through him who strengthens me.", explanation: "A reminder of the strength and empowerment we receive from Christ." },
      { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.", explanation: "Encouragement to trust God fully in every aspect of life." },
      { reference: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.", explanation: "God has a purposeful and hopeful plan for our lives." },
      { reference: "Romans 8:28", text: "And we know that for those who love God all things work together for good, for those who are called according to his purpose.", explanation: "Assurance that God works all things out for our ultimate good." },
      { reference: "Isaiah 41:10", text: "Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.", explanation: "A comforting promise of God’s presence and support in times of fear." },
      { reference: "Psalm 23:1", text: "The Lord is my shepherd; I shall not want.", explanation: "A beautiful declaration of God’s provision and care as our Shepherd." }
    ];
    let hash = 0;
    const str = todayStr + communityId;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % verses.length;
    const verseData = verses[index];
    
    const verseId = crypto.randomUUID();
    const [newVerse] = await db.insert(communityDailyVerse).values({
      id: verseId,
      communityId,
      date: todayStr,
      reference: verseData.reference,
      text: verseData.text,
      explanation: verseData.explanation,
      likesCount: 0,
      sharesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    verse = newVerse;
  }
  
  const userLike = await db.query.communityDailyVerseLike.findFirst({
    where: and(eq(communityDailyVerseLike.userId, userId), eq(communityDailyVerseLike.verseId, verse.id))
  });
  
  return c.json({
    ...verse,
    hasLiked: !!userLike,
    backgroundImageUrl: comRes.image
  });
});

app.post("/:id/verse-today/like", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const db = getDb(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  
  const verse = await db.query.communityDailyVerse.findFirst({
    where: and(eq(communityDailyVerse.communityId, communityId), eq(communityDailyVerse.date, todayStr))
  });
  if (!verse) return c.json({ error: "Verse not found" }, 404);
  
  const existingLike = await db.query.communityDailyVerseLike.findFirst({
    where: and(eq(communityDailyVerseLike.userId, userId), eq(communityDailyVerseLike.verseId, verse.id))
  });
  
  if (existingLike) {
    await db.delete(communityDailyVerseLike).where(eq(communityDailyVerseLike.id, existingLike.id));
    await db.update(communityDailyVerse).set({ likesCount: sql\`\${communityDailyVerse.likesCount} - 1\`, updatedAt: new Date() }).where(eq(communityDailyVerse.id, verse.id));
    return c.json({ liked: false });
  } else {
    await db.insert(communityDailyVerseLike).values({
      id: crypto.randomUUID(),
      userId,
      verseId: verse.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.update(communityDailyVerse).set({ likesCount: sql\`\${communityDailyVerse.likesCount} + 1\`, updatedAt: new Date() }).where(eq(communityDailyVerse.id, verse.id));
    return c.json({ liked: true });
  }
});

app.post("/:id/verse-today/share", async (c) => {
  const communityId = c.req.param("id");
  const db = getDb(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  
  const verse = await db.query.communityDailyVerse.findFirst({
    where: and(eq(communityDailyVerse.communityId, communityId), eq(communityDailyVerse.date, todayStr))
  });
  if (!verse) return c.json({ error: "Verse not found" }, 404);
  
  await db.update(communityDailyVerse).set({ sharesCount: sql\`\${communityDailyVerse.sharesCount} + 1\`, updatedAt: new Date() }).where(eq(communityDailyVerse.id, verse.id));
  
  return c.json({ message: "Shared successfully" });
});

export default app;
`;
fs.writeFileSync('src/routes/communities/verse.ts', code);
console.log('Migrated verse.ts to Drizzle!');
