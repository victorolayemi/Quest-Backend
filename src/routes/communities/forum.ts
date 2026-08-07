import { Hono } from 'hono';
import { getDrizzle } from '../../utils/drizzle';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';
import { groupMessage, communityMember, user } from '../../db/schema';
import { eq, or, and, not, like, sql, inArray, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

app.get("/:id/forum", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const db = getDrizzle(c.env.DB);
  let conditions = eq(groupMessage.communityId, communityId);
  if (cursor) {
    const cursorMsg = await db.query.groupMessage.findFirst({ where: eq(groupMessage.id, cursor) });
    if (cursorMsg) {
      conditions = and(conditions, sql`${groupMessage.createdAt} < ${cursorMsg.createdAt}`) as any;
    }
  }

  const list = await db.query.groupMessage.findMany({
    where: conditions,
    limit: 50,
    orderBy: [desc(groupMessage.createdAt)],
    with: { user: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  return c.json(list);
});

app.post("/:id/forum/messages", checkCommunityRestriction, async (c) => {
  const communityId = c.req.param("id");
  const senderId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, imageUrl, videoUrl, videoThumbnail, audioUrl, audioThumbnail } = body;
  const db = getDrizzle(c.env.DB);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId as string), eq(communityMember.userId, senderId as string))
  });
  if (!mem) {
    return c.json({ error: "Only members can post messages in the forum" }, 403);
  }
  
  const msgId = crypto.randomUUID();
  const [msg] = await db.insert(groupMessage).values({
    id: msgId,
    communityId: communityId as string,
    senderId: senderId as string,
    text,
    imageUrl,
    videoUrl,
    videoThumbnail,
    audioUrl,
    audioThumbnail,
    
    
  }).returning();
  
  const members = await db.select({ userId: communityMember.userId }).from(communityMember).where(and(eq(communityMember.communityId, msg.communityId as string), not(eq(communityMember.userId, msg.senderId))));
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  
  const userRes = await db.query.user.findFirst({ where: eq(user.id, senderId) });
  const senderName = userRes?.firstName || userRes?.username || "Someone";
  
  for (const m of members) {
    await dispatchNotification({
      db,
      userId: m.userId,
      title: "New Forum Message",
      message: `${senderName}: ${text || "Sent an attachment"}`,
      type: "COMMUNITY_FORUM",
      pushSettingKey: "pushCommunityForum",
      fcm,
      data: { type: "COMMUNITY_FORUM", communityId }
    });
  }
  return c.json({ ...msg, sender: userRes });
});

app.delete("/forum/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const msg = await db.query.groupMessage.findFirst({ where: eq(groupMessage.id, id) });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, msg.communityId), eq(communityMember.userId, userId as string))
  });
  
  if (mem?.role !== "ADMIN" && msg.senderId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await db.delete(groupMessage).where(eq(groupMessage.id, id));
  return c.json({ message: "Message deleted successfully" });
});

export default app;
