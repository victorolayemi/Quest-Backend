
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and, sql, inArray, desc } from 'drizzle-orm';
import { friendRequest, user, userFeeling, affirmation } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/friends.ts
import { Bindings, Variables } from '../types';
var friends = new Hono<{Bindings: Bindings, Variables: Variables}>();
friends.use("*", authMiddleware);

friends.get("/suggestions", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  // Get users who are already friends or have pending requests
  const existingRelations = await db.query.friendRequest.findMany({
    where: or(
      eq(friendRequest.senderId, userId as string),
      eq(friendRequest.receiverId, userId as string)
    ),
    columns: { senderId: true, receiverId: true }
  });

  const excludeIds = new Set<string>([userId as string]);
  for (const r of existingRelations) {
    excludeIds.add(r.senderId);
    excludeIds.add(r.receiverId);
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const suggestions = await db.query.user.findMany({
    where: (u, { notInArray, ne }) => notInArray(u.id, [...excludeIds]),
    columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true },
    limit,
    offset,
    orderBy: (u, { desc }) => [desc(u.createdAt)]
  });

  return c.json(suggestions);
});


friends.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const q = c.req.query("q")?.trim()?.toLowerCase();
  const offset = (page - 1) * limit;

  const list = await db.query.friendRequest.findMany({
    where: or(
      and(eq(friendRequest.senderId, userId as string), eq(friendRequest.status, "ACCEPTED")),
      and(eq(friendRequest.receiverId, userId as string), eq(friendRequest.status, "ACCEPTED"))
    )
  });

  const friendIds = list.map((r: any) => r.senderId === userId ? r.receiverId : r.senderId);

  if (friendIds.length === 0) return c.json([]);

  let whereClause = inArray(user.id, friendIds);
  if (q) {
    whereClause = and(
      whereClause,
      or(
        sql`LOWER(${user.firstName}) LIKE ${'%' + q + '%'}`,
        sql`LOWER(${user.lastName}) LIKE ${'%' + q + '%'}`,
        sql`LOWER(${user.username}) LIKE ${'%' + q + '%'}`
      )
    ) as any;
  }

  const friendsList = await db.query.user.findMany({
    where: whereClause,
    columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, bio: true },
    limit,
    offset
  });
  
  return c.json(friendsList);
});

friends.post("/request", async (c) => {
  const senderId = c.get("userId");
  const body = await c.req.json() as any;
  const { receiverId } = body;
  const db = getDrizzle(c.env.DB);
  
  if (senderId === receiverId) {
    return c.json({ error: "Cannot send request to yourself" }, 400);
  }
  
  const existing = await db.query.friendRequest.findFirst({
    where: or(
      and(eq(friendRequest.senderId, senderId as string), eq(friendRequest.receiverId, receiverId as string)),
      and(eq(friendRequest.senderId, receiverId as string), eq(friendRequest.receiverId, senderId as string))
    )
  });
  
  if (existing) {
    return c.json({ error: "Relationship request already exists", status: existing.status }, 400);
  }
  
  const reqId = crypto.randomUUID();
  const [req] = await db.insert(friendRequest).values({
    id: reqId,
    senderId: senderId as string,
    receiverId: receiverId as string,
    status: "PENDING"
  }).returning();
  
  const senderRes = await db.query.user.findFirst({ where: eq(user.id, senderId as string), columns: { firstName: true, username: true } });
  
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  await dispatchNotification({
    db,
    userId: receiverId,
    title: "New Friend Request",
    message: `${senderRes?.firstName || senderRes?.username || "Someone"} sent you a friend request.`,
    type: "FRIEND_REQUEST",
    pushSettingKey: "pushConnectionRequests",
    fcm,
    data: { type: "FRIEND_REQUEST", senderId }
  });
  
  return c.json({ message: "Friend request sent", request: req });
});

friends.post("/:userId/accept", async (c) => {
  const receiverId = c.get("userId");
  const senderId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  const req = await db.query.friendRequest.findFirst({
    where: and(
      eq(friendRequest.senderId, senderId as string),
      eq(friendRequest.receiverId, receiverId as string),
      eq(friendRequest.status, "PENDING")
    )
  });
  
  if (!req) {
    return c.json({ error: "Pending friend request not found" }, 404);
  }
  
  const [updated] = await db.update(friendRequest).set({ status: "ACCEPTED" }).where(eq(friendRequest.id, req.id)).returning();
  
  const receiverRes = await db.query.user.findFirst({ where: eq(user.id, receiverId as string), columns: { firstName: true, username: true } });
  
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  await dispatchNotification({
    db,
    userId: senderId,
    title: "Friend Request Accepted",
    message: `${receiverRes?.firstName || receiverRes?.username || "Someone"} accepted your friend request.`,
    type: "FRIEND_ACCEPTED",
    pushSettingKey: "pushConnectionAccepted",
    fcm,
    data: { type: "FRIEND_ACCEPTED", receiverId }
  });
  
  return c.json({ message: "Friend request accepted", request: updated });
});

friends.post("/:userId/reject", async (c) => {
  const receiverId = c.get("userId");
  const senderId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  const req = await db.query.friendRequest.findFirst({
    where: and(
      eq(friendRequest.senderId, senderId as string),
      eq(friendRequest.receiverId, receiverId as string),
      eq(friendRequest.status, "PENDING")
    )
  });
  
  if (!req) {
    return c.json({ error: "Pending friend request not found" }, 404);
  }
  
  const [updated] = await db.update(friendRequest).set({ status: "REJECTED" }).where(eq(friendRequest.id, req.id)).returning();
  
  return c.json({ message: "Friend request rejected", request: updated });
});

friends.delete("/:userId", async (c) => {
  const userId = c.get("userId");
  const friendId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  const req = await db.query.friendRequest.findFirst({
    where: or(
      and(eq(friendRequest.senderId, userId as string), eq(friendRequest.receiverId, friendId as string)),
      and(eq(friendRequest.senderId, friendId as string), eq(friendRequest.receiverId, userId as string))
    )
  });
  
  if (!req) return c.json({ error: "Friendship not found" }, 404);
  
  await db.delete(friendRequest).where(eq(friendRequest.id, req.id));
  
  return c.json({ message: "Friend removed successfully" });
});

friends.get("/requests/sent", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const list = await db.query.friendRequest.findMany({
    where: and(eq(friendRequest.senderId, userId as string), eq(friendRequest.status, "PENDING")),
    with: { user_receiverId: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
    limit,
    offset
  });
  
  return c.json(list.map((r: any) => r.user_receiverId));
});

friends.get("/requests/pending", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const list = await db.query.friendRequest.findMany({
    where: and(eq(friendRequest.receiverId, userId as string), eq(friendRequest.status, "PENDING")),
    with: { user_senderId: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
    limit,
    offset
  });
  
  return c.json(list.map((r: any) => r.user_senderId));
});

friends.post("/:userId/block", async (c) => {
  const userId = c.get("userId");
  const targetId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  const relation = await db.query.friendRequest.findFirst({
    where: or(
      and(eq(friendRequest.senderId, userId as string), eq(friendRequest.receiverId, targetId as string)),
      and(eq(friendRequest.senderId, targetId as string), eq(friendRequest.receiverId, userId as string))
    )
  });
  
  if (relation) {
    await db.update(friendRequest).set({
      senderId: userId as string,
      receiverId: targetId as string,
      status: "BLOCKED"
    }).where(eq(friendRequest.id, relation.id));
  } else {
    await db.insert(friendRequest).values({
      id: crypto.randomUUID(),
      senderId: userId as string,
      receiverId: targetId as string,
      status: "BLOCKED"
    });
  }
  
  return c.json({ message: "User blocked successfully" });
});

friends.post("/:userId/unblock", async (c) => {
  const userId = c.get("userId");
  const targetId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  const relation = await db.query.friendRequest.findFirst({
    where: and(
      eq(friendRequest.senderId, userId as string),
      eq(friendRequest.receiverId, targetId as string),
      eq(friendRequest.status, "BLOCKED")
    )
  });
  
  if (!relation) {
    return c.json({ error: "Block relationship not found" }, 404);
  }
  
  await db.delete(friendRequest).where(eq(friendRequest.id, relation.id));
  
  return c.json({ message: "User unblocked successfully" });
});

friends.get("/blocked", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.friendRequest.findMany({
    where: and(eq(friendRequest.senderId, userId as string), eq(friendRequest.status, "BLOCKED")),
    with: { user_receiverId: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  
  return c.json(list.map((r: any) => r.user_receiverId));
});

friends.get("/feelings", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const friendships = await db.query.friendRequest.findMany({
    where: or(
      and(eq(friendRequest.senderId, userId as string), eq(friendRequest.status, "ACCEPTED")),
      and(eq(friendRequest.receiverId, userId as string), eq(friendRequest.status, "ACCEPTED"))
    )
  });
  
  const friendIds = friendships.map((f: any) => f.senderId === userId ? f.receiverId : f.senderId);
  
  if (friendIds.length === 0) return c.json([]);
  
  const feelingsList = await db.query.userFeeling.findMany({
    where: inArray(userFeeling.userId, friendIds),
    with: { user: { columns: { firstName: true, username: true, avatarUrl: true } } },
    orderBy: [desc(userFeeling.createdAt)]
  });
  
  return c.json(feelingsList);
});

friends.put("/me/feeling", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { feeling, emoji } = body;
  const db = getDrizzle(c.env.DB);
  
  let record;
  const existing = await db.query.userFeeling.findFirst({ where: eq(userFeeling.userId, userId as string) });
  if (existing) {
    [record] = await db.update(userFeeling)
      .set({ feeling, emoji })
      .where(eq(userFeeling.userId, userId as string))
      .returning();
  } else {
    [record] = await db.insert(userFeeling).values({
      id: crypto.randomUUID(),
      userId: userId as string,
      feeling,
      emoji
    }).returning();
  }
  
  let affirmationsList: any[] = [];
  if (feeling) {
    affirmationsList = await db.query.affirmation.findMany({
      where: eq(affirmation.feeling, feeling)
    });
  }
  
  if (affirmationsList.length === 0) {
    affirmationsList = await db.query.affirmation.findMany({
      where: sql`${affirmation.feeling} IS NULL`
    });
  }
  
  let affirmationText = "God loves me, and I know it";
  if (affirmationsList.length > 0) {
    const idx = Math.floor(Math.random() * affirmationsList.length);
    affirmationText = affirmationsList[idx].text;
  }
  
  return c.json({
    ...record,
    affirmation: affirmationText
  });
});

friends.delete("/me/feeling", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  try {
    await db.delete(userFeeling).where(eq(userFeeling.userId, userId as string));
  } catch (e) {}
  
  return c.json({ message: "Feeling removed successfully" });
});

friends.get("/:userId/feeling", async (c) => {
  const targetId = c.req.param("userId");
  const db = getDrizzle(c.env.DB);
  
  try {
    const feeling = await db.query.userFeeling.findFirst({
      where: eq(userFeeling.userId, targetId)
    });
    return c.json(feeling ?? null);
  } catch (error) {
    return c.json({ error: "Failed to fetch feeling" }, 500);
  }
});

export default friends;
