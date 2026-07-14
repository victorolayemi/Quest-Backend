
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/friends.ts
import { Bindings, Variables } from '../types';
var friends = new Hono<{Bindings: Bindings, Variables: Variables}>();
friends.use("*", authMiddleware);
friends.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { senderId: userId, status: "ACCEPTED" },
        { receiverId: userId, status: "ACCEPTED" }
      ]
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, bio: true } },
      receiver: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, bio: true } }
    }
  });
  const friendsList = list.map((fr: any) => {
    return fr.senderId === userId ? fr.receiver : fr.sender;
  });
  return c.json(friendsList);
});
friends.get("/suggestions", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existingRelations = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ]
    }
  });
  const relatedUserIds = /* @__PURE__ */ new Set();
  relatedUserIds.add(userId);
  existingRelations.forEach((r: any) => {
    relatedUserIds.add(r.senderId);
    relatedUserIds.add(r.receiverId);
  });
  const suggestions = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(relatedUserIds) as string[] }
    },
    take: 10,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      avatarUrl: true
    }
  });
  return c.json(suggestions);
});
friends.post("/:userId/request", async (c) => {
  const senderId = c.get("userId");
  const receiverId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  if (senderId === receiverId) {
    return c.json({ error: "Cannot add yourself as a friend" }, 400);
  }
  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    }
  });
  if (existing) {
    return c.json({ error: "Relationship request already exists", status: existing.status }, 400);
  }
  const req = await prisma.friendRequest.create({
    data: {
      senderId,
      receiverId,
      status: "PENDING"
    }
  });
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, username: true } });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  await dispatchNotification({
    prisma,
    userId: receiverId,
    title: "New Friend Request",
    message: `${sender?.firstName || sender?.username || "Someone"} sent you a friend request.`,
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
  const prisma = getPrisma(c.env.DB);
  const req = await prisma.friendRequest.findFirst({
    where: { senderId, receiverId, status: "PENDING" }
  });
  if (!req) {
    return c.json({ error: "Pending friend request not found" }, 404);
  }
  const updated = await prisma.friendRequest.update({
    where: { id: req.id },
    data: { status: "ACCEPTED" }
  });
  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { firstName: true, username: true } });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  await dispatchNotification({
    prisma,
    userId: senderId,
    title: "Friend Request Accepted",
    message: `${receiver?.firstName || receiver?.username || "Someone"} accepted your friend request.`,
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
  const prisma = getPrisma(c.env.DB);
  const req = await prisma.friendRequest.findFirst({
    where: { senderId, receiverId, status: "PENDING" }
  });
  if (!req) {
    return c.json({ error: "Pending friend request not found" }, 404);
  }
  const updated = await prisma.friendRequest.update({
    where: { id: req.id },
    data: { status: "REJECTED" }
  });
  return c.json({ message: "Friend request rejected", request: updated });
});
friends.delete("/:userId", async (c) => {
  const userId = c.get("userId");
  const friendId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  const req = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId }
      ]
    }
  });
  if (!req) return c.json({ error: "Friendship not found" }, 404);
  await prisma.friendRequest.delete({ where: { id: req.id } });
  return c.json({ message: "Friend removed successfully" });
});
friends.get("/requests/sent", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.friendRequest.findMany({
    where: { senderId: userId, status: "PENDING" },
    include: { receiver: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  return c.json(list.map((r: any) => r.receiver));
});
friends.get("/requests/pending", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: "PENDING" },
    include: { sender: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  return c.json(list.map((r: any) => r.sender));
});
friends.post("/:userId/block", async (c) => {
  const userId = c.get("userId");
  const targetId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  const relation = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: targetId },
        { senderId: targetId, receiverId: userId }
      ]
    }
  });
  if (relation) {
    await prisma.friendRequest.update({
      where: { id: relation.id },
      data: {
        senderId: userId,
        // Ensure blocker is sender
        receiverId: targetId,
        status: "BLOCKED"
      }
    });
  } else {
    await prisma.friendRequest.create({
      data: {
        senderId: userId,
        receiverId: targetId,
        status: "BLOCKED"
      }
    });
  }
  return c.json({ message: "User blocked successfully" });
});
friends.post("/:userId/unblock", async (c) => {
  const userId = c.get("userId");
  const targetId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  const relation = await prisma.friendRequest.findFirst({
    where: {
      senderId: userId,
      receiverId: targetId,
      status: "BLOCKED"
    }
  });
  if (!relation) {
    return c.json({ error: "Block relationship not found" }, 404);
  }
  await prisma.friendRequest.delete({
    where: { id: relation.id }
  });
  return c.json({ message: "User unblocked successfully" });
});
friends.get("/blocked", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.friendRequest.findMany({
    where: { senderId: userId, status: "BLOCKED" },
    include: { receiver: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  return c.json(list.map((r: any) => r.receiver));
});
friends.get("/feelings", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const friendships = await prisma.friendRequest.findMany({
    where: {
      OR: [
        { senderId: userId, status: "ACCEPTED" },
        { receiverId: userId, status: "ACCEPTED" }
      ]
    }
  });
  const friendIds = friendships.map((f: any) => f.senderId === userId ? f.receiverId : f.senderId);
  const feelingsList = await prisma.userFeeling.findMany({
    where: { userId: { in: friendIds } },
    include: { user: { select: { firstName: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" }
  });
  return c.json(feelingsList);
});
friends.put("/me/feeling", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { feeling, emoji } = body;
  const prisma = getPrisma(c.env.DB);
  const record = await prisma.userFeeling.upsert({
    where: { userId },
    update: { feeling, emoji, createdAt: /* @__PURE__ */ new Date() },
    create: { userId, feeling, emoji }
  });
  let affirmations: any[] = [];
  if (feeling) {
    affirmations = await prisma.affirmation.findMany({
      where: { feeling }
    });
  }
  if (affirmations.length === 0) {
    affirmations = await prisma.affirmation.findMany({
      where: { feeling: null }
    });
  }
  let affirmationText = "God loves me, and I know it";
  if (affirmations.length > 0) {
    const idx = Math.floor(Math.random() * affirmations.length);
    affirmationText = affirmations[idx].text;
  }
  return c.json({
    ...record,
    affirmation: affirmationText
  });
});
friends.delete("/me/feeling", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  await prisma.userFeeling.delete({ where: { userId } }).catch(() => null);
  return c.json({ message: "Feeling removed successfully" });
});
friends.get("/:userId/feeling", async (c) => {
  const targetId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  try {
    const feeling = await prisma.userFeeling.findUnique({
      where: { userId: targetId }
    });
    return c.json(feeling ?? null);
  } catch (error) {
    return c.json({ error: "Failed to fetch feeling" }, 500);
  }
});


export default friends;
