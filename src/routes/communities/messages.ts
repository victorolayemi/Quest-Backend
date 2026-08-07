import { Hono } from 'hono';
import { getDrizzle } from '../../utils/drizzle';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';
import { 
  communityMessage, communityMessageBookmark, communityMessageLike, 
  communityMember, community, user, communityMessageComment, 
  communityMessageReaction, communityMessageCommentLike 
} from '../../db/schema';
import { eq, or, and, not, like, sql, inArray, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

app.get("/messages/saved", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const search = (c.req.query("search") ?? "").trim().toLowerCase();

  try {
    let messageConditions = undefined;
    if (search) {
      messageConditions = or(
        like(communityMessage.title, `%${search}%`),
        like(communityMessage.text, `%${search}%`)
      );
    }
    
    // Manual join logic for filtering by message fields if search is provided
    let query = db.select({
      bookmark: communityMessageBookmark,
      message: communityMessage,
      sender: user
    })
    .from(communityMessageBookmark)
    .leftJoin(communityMessage, eq(communityMessageBookmark.messageId, communityMessage.id))
    .leftJoin(user, eq(communityMessage.senderId, user.id))
    .where(and(eq(communityMessageBookmark.userId, userId as string), messageConditions))
    .orderBy(desc(communityMessageBookmark.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
    
    const savedMessages = await query;
    
    // For total count
    const countQuery = await db.select({ count: sql<number>`count(*)` })
      .from(communityMessageBookmark)
      .leftJoin(communityMessage, eq(communityMessageBookmark.messageId, communityMessage.id))
      .where(and(eq(communityMessageBookmark.userId, userId as string), messageConditions));
    const total = Number(countQuery[0]?.count || 0);

    const formatted = savedMessages.map((bm: any) => ({
      id: bm.message.id,
      title: bm.message.title,
      text: bm.message.text,
      imageUrl: bm.message.imageUrl,
      createdAt: bm.message.createdAt,
      likesCount: bm.message.likesCount,
      sender: bm.sender ? {
        ...bm.sender,
        fullName: bm.sender.firstName ? `${bm.sender.firstName} ${bm.sender.lastName || ''}`.trim() : null
      } : null
    }));

    return c.json({
      data: formatted,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch saved messages" }, 500);
  }
});

app.get("/me/messages", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const take = parseInt(c.req.query("limit") || "20", 10);
  
  try {
    const memberComs = await db.select({ id: communityMember.communityId }).from(communityMember).where(eq(communityMember.userId, userId as string));
    const memberComIds = memberComs.map(m => m.id);
    
    if (memberComIds.length === 0) return c.json({ data: [], nextCursor: null });

    let conditions = inArray(communityMessage.communityId, memberComIds);
    if (cursor) {
      const cursorMsg = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, cursor) });
      if (cursorMsg) {
        conditions = and(conditions, sql`${communityMessage.createdAt} < ${cursorMsg.createdAt}`) as any;
      }
    }

    const messages = await db.query.communityMessage.findMany({
      where: conditions,
      limit: take,
      orderBy: [desc(communityMessage.createdAt)],
      with: {
        user: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
        community: { columns: { id: true, name: true, image: true } }
      }
    });

    let userLikes: any[] = [];
    let userBookmarks: any[] = [];
    if (userId) {
      const messageIds = messages.map(m => m.id);
      if (messageIds.length > 0) {
        userLikes = await db.select({ messageId: communityMessageLike.messageId }).from(communityMessageLike).where(and(eq(communityMessageLike.userId, userId as string), inArray(communityMessageLike.messageId, messageIds)));
        userBookmarks = await db.select({ messageId: communityMessageBookmark.messageId }).from(communityMessageBookmark).where(and(eq(communityMessageBookmark.userId, userId as string), inArray(communityMessageBookmark.messageId, messageIds)));
      }
    }

    const formattedMessages = messages.map((msg: any) => ({
      ...msg,
      likesCount: Number(msg.likesCount || 0),
      commentsCount: Number(msg.commentsCount || 0),
      sharesCount: Number(msg.sharesCount || 0),
      isLiked: userLikes.some(l => l.messageId === msg.id),
      isBookmarked: userBookmarks.some(b => b.messageId === msg.id)
    }));
    
    return c.json({
      data: formattedMessages,
      nextCursor: messages.length === take ? messages[take - 1].id : null
    });
  } catch (error) {
    console.error("Error fetching my admin messages:", error);
    return c.json({ error: "Failed to fetch admin messages" }, 500);
  }
});

app.get("/:id/messages", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  let conditions = eq(communityMessage.communityId, communityId);
  if (cursor) {
    const cursorMsg = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, cursor) });
    if (cursorMsg) {
      conditions = and(conditions, sql`${communityMessage.createdAt} < ${cursorMsg.createdAt}`) as any;
    }
  }

  const list = await db.query.communityMessage.findMany({
    where: conditions,
    limit: 50,
    orderBy: [desc(communityMessage.createdAt)],
    with: {
      user: { columns: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
    }
  });
  
  let userLikes: any[] = [];
  let userBookmarks: any[] = [];
  if (userId) {
    const messageIds = list.map(m => m.id);
    if (messageIds.length > 0) {
      userLikes = await db.select({ messageId: communityMessageLike.messageId }).from(communityMessageLike).where(and(eq(communityMessageLike.userId, userId as string), inArray(communityMessageLike.messageId, messageIds)));
      userBookmarks = await db.select({ messageId: communityMessageBookmark.messageId }).from(communityMessageBookmark).where(and(eq(communityMessageBookmark.userId, userId as string), inArray(communityMessageBookmark.messageId, messageIds)));
    }
  }
  
  const result = list.map((m: any) => ({
    ...m,
    hasLiked: userLikes.some((l: any) => l.messageId === m.id),
    hasBookmarked: userBookmarks.some((b: any) => b.messageId === m.id)
  }));
  return c.json(result);
});

app.post("/:id/messages", checkCommunityRestriction, async (c) => {
  const communityId = c.req.param("id");
  const senderId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, title, imageUrl, videoUrl, videoThumbnail, audioUrl, audioThumbnail } = body;
  const db = getDrizzle(c.env.DB);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId as string), eq(communityMember.userId, senderId as string))
  });
  if (!mem || mem.role !== "ADMIN") {
    return c.json({ error: "Only admins can post messages" }, 403);
  }
  
  const msgId = crypto.randomUUID();
  const [msg] = await db.insert(communityMessage).values({
    id: msgId,
    communityId: communityId as string,
    senderId: senderId as string,
    text,
    title,
    imageUrl,
    videoUrl,
    videoThumbnail,
    audioUrl,
    audioThumbnail,
    
    
  }).returning();
  
  const userRes = await db.query.user.findFirst({ where: eq(user.id, senderId) });
  const members = await db.select({ userId: communityMember.userId }).from(communityMember).where(and(eq(communityMember.communityId, communityId as string), not(eq(communityMember.userId, senderId as string))));
  
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const senderName = userRes?.firstName || userRes?.username || "Someone";
  
  for (const m of members) {
    await dispatchNotification({
      db,
      userId: m.userId,
      title: "New Community Message",
      message: `${senderName}: ${text || "Sent an attachment"}`,
      type: "COMMUNITY_MESSAGE",
      pushSettingKey: "pushCommunityForum",
      fcm,
      data: { type: "COMMUNITY_MESSAGE", communityId },
      logInDb: false
    });
  }
  return c.json({ ...msg, sender: userRes });
});

app.delete("/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const msg = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, id) });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, msg.communityId), eq(communityMember.userId, userId as string))
  });
  if (mem?.role !== "ADMIN" && msg.senderId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await db.delete(communityMessage).where(eq(communityMessage.id, id));
  return c.json({ message: "Message deleted successfully" });
});

app.post("/:id/messages/:msgId/like", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const message2 = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, msgId) });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  
  const existingLike = await db.query.communityMessageLike.findFirst({
    where: and(eq(communityMessageLike.userId, userId as string), eq(communityMessageLike.messageId, msgId))
  });
  
  if (existingLike) {
    await db.delete(communityMessageLike).where(eq(communityMessageLike.id, existingLike.id));
    await db.update(communityMessage).set({ likesCount: sql`${communityMessage.likesCount} - 1`,  }).where(eq(communityMessage.id, msgId));
    return c.json({ liked: false });
  } else {
    await db.insert(communityMessageLike).values({
      id: crypto.randomUUID(),
      userId,
      messageId: msgId,
      
      
    });
    await db.update(communityMessage).set({ likesCount: sql`${communityMessage.likesCount} + 1`,  }).where(eq(communityMessage.id, msgId));
    return c.json({ liked: true });
  }
});

app.post("/:id/messages/:msgId/bookmark", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const message2 = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, msgId) });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  
  const existingBookmark = await db.query.communityMessageBookmark.findFirst({
    where: and(eq(communityMessageBookmark.userId, userId as string), eq(communityMessageBookmark.messageId, msgId))
  });
  
  if (existingBookmark) {
    await db.delete(communityMessageBookmark).where(eq(communityMessageBookmark.id, existingBookmark.id));
    await db.update(communityMessage).set({ bookmarksCount: sql`${communityMessage.bookmarksCount} - 1`,  }).where(eq(communityMessage.id, msgId));
    return c.json({ bookmarked: false });
  } else {
    await db.insert(communityMessageBookmark).values({
      id: crypto.randomUUID(),
      userId,
      messageId: msgId,
      
      
    });
    await db.update(communityMessage).set({ bookmarksCount: sql`${communityMessage.bookmarksCount} + 1`,  }).where(eq(communityMessage.id, msgId));
    return c.json({ bookmarked: true });
  }
});

app.post("/:id/messages/:msgId/share", async (c) => {
  const msgId = c.req.param("msgId");
  const db = getDrizzle(c.env.DB);
  
  const message2 = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, msgId) });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  
  await db.update(communityMessage).set({ sharesCount: sql`${communityMessage.sharesCount} + 1`,  }).where(eq(communityMessage.id, msgId));
  return c.json({ success: true });
});

app.get("/:id/messages/:msgId/comments", async (c) => {
  const msgId = c.req.param("msgId");
  const db = getDrizzle(c.env.DB);
  
  const comments = await db.query.communityMessageComment.findMany({
    where: and(eq(communityMessageComment.messageId, msgId), sql`${communityMessageComment.parentId} IS NULL`),
    with: {
      user: { columns: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      communityMessageComments: {
        with: {
          user: { columns: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
        },
        orderBy: [asc(communityMessageComment.createdAt)]
      }
    },
    orderBy: [desc(communityMessageComment.createdAt)]
  });
  return c.json(comments);
});

app.post("/:id/messages/:msgId/comments", checkCommunityRestriction, async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, parentId } = body;
  const db = getDrizzle(c.env.DB);
  
  if (!text || text.trim() === "") {
    return c.json({ error: "Text is required" }, 400);
  }
  
  const commentId = crypto.randomUUID();
  const [comment] = await db.insert(communityMessageComment).values({
    id: commentId,
    userId: userId as string,
    messageId: msgId as string,
    text,
    parentId: parentId || null,
    
    
  }).returning();
  
  await db.update(communityMessage).set({ commentsCount: sql`${communityMessage.commentsCount} + 1`,  }).where(eq(communityMessage.id, msgId as string));
  
  const userRes = await db.query.user.findFirst({ where: eq(user.id, userId as string) });
  
  return c.json({ ...comment, user: userRes });
});

app.put("/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const db = getDrizzle(c.env.DB);
  
  const msg = await db.query.communityMessage.findFirst({ where: eq(communityMessage.id, id) });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  if (msg.senderId !== userId) return c.json({ error: "Not authorized" }, 403);
  
  const data: any = {  };
  if (body.text !== undefined) data.text = body.text;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.videoUrl !== undefined) data.videoUrl = body.videoUrl;
  if (body.audioUrl !== undefined) data.audioUrl = body.audioUrl;
  if (body.videoThumbnail !== undefined) data.videoThumbnail = body.videoThumbnail;
  if (body.audioThumbnail !== undefined) data.audioThumbnail = body.audioThumbnail;
  
  const [updated] = await db.update(communityMessage).set(data).where(eq(communityMessage.id, id)).returning();
  return c.json(updated);
});

app.post("/:id/messages/:msgId/react", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const { emoji } = await c.req.json() as any;
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.communityMessageReaction.findFirst({
    where: and(eq(communityMessageReaction.userId, userId as string), eq(communityMessageReaction.messageId, msgId), eq(communityMessageReaction.emoji, emoji))
  });
  
  if (existing) {
    await db.delete(communityMessageReaction).where(eq(communityMessageReaction.id, existing.id));
    return c.json({ added: false });
  } else {
    await db.insert(communityMessageReaction).values({
      id: crypto.randomUUID(),
      userId,
      messageId: msgId,
      emoji,
      
      
    });
    return c.json({ added: true });
  }
});

app.post("/:id/messages/comments/:commentId/like", async (c) => {
  const commentId = c.req.param("commentId");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.communityMessageCommentLike.findFirst({
    where: and(eq(communityMessageCommentLike.userId, userId as string), eq(communityMessageCommentLike.commentId, commentId))
  });
  
  if (existing) {
    await db.delete(communityMessageCommentLike).where(eq(communityMessageCommentLike.id, existing.id));
    await db.update(communityMessageComment).set({ likesCount: sql`${communityMessageComment.likesCount} - 1`,  }).where(eq(communityMessageComment.id, commentId));
    return c.json({ liked: false });
  } else {
    await db.insert(communityMessageCommentLike).values({
      id: crypto.randomUUID(),
      userId,
      commentId,
      
      
    });
    await db.update(communityMessageComment).set({ likesCount: sql`${communityMessageComment.likesCount} + 1`,  }).where(eq(communityMessageComment.id, commentId));
    return c.json({ liked: true });
  }
});

export default app;
