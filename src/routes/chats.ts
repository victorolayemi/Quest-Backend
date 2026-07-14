
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/chats.ts
import { Bindings, Variables } from '../types';
var chats = new Hono<{Bindings: Bindings, Variables: Variables}>();
chats.use("*", authMiddleware);
chats.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const activeChats = await prisma.directChat.findMany({
    where: {
      OR: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    },
    include: {
      user1: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
      user2: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      ChatClear: {
        where: { userId }
      }
    }
  });
  const list = await Promise.all(activeChats.map(async (chat: any) => {
    const friend = chat.user1Id === userId ? chat.user2 : chat.user1;
    let lastMsg = chat.messages[0] || null;
    if (lastMsg && chat.ChatClear.length > 0) {
      if (lastMsg.createdAt <= chat.ChatClear[0].clearedAt) {
        lastMsg = null;
      }
    }
    const unreadCount = await prisma.directMessage.count({
      where: {
        chatId: chat.id,
        senderId: { not: userId },
        isRead: false
      }
    });
    return {
      id: chat.id,
      friend,
      lastMessage: lastMsg,
      createdAt: chat.createdAt,
      unreadCount
    };
  }));
  return c.json(list);
});
chats.get("/:chatId", async (c) => {
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");
  const prisma = getPrisma(c.env.DB);
  const clearRecord = await prisma.chatClear.findUnique({
    where: {
      chatId_userId: { chatId, userId }
    }
  });
  const list = await prisma.directMessage.findMany({
    where: {
      chatId,
      ...clearRecord ? { createdAt: { gt: clearRecord.clearedAt } } : {}
    },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });
  return c.json(list);
});
chats.post("/", async (c) => {
  const user1Id = c.get("userId");
  const body = await c.req.json();
  const { friendId } = body;
  const prisma = getPrisma(c.env.DB);
  if (user1Id === friendId) {
    return c.json({ error: "Cannot start chat with yourself" }, 400);
  }
  let chat = await prisma.directChat.findFirst({
    where: {
      OR: [
        { user1Id, user2Id: friendId },
        { user1Id: friendId, user2Id: user1Id }
      ]
    },
    include: {
      user1: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
      user2: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } }
    }
  });
  if (!chat) {
    chat = await prisma.directChat.create({
      data: {
        user1Id,
        user2Id: friendId
      },
      include: {
        user1: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
        user2: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } }
      }
    });
  }
  const friend = chat.user1Id === user1Id ? chat.user2 : chat.user1;
  return c.json({
    id: chat.id,
    friend,
    createdAt: chat.createdAt
  });
});
chats.post("/:chatId/messages", async (c) => {
  const senderId = c.get("userId");
  const chatId = c.req.param("chatId");
  const body = await c.req.json();
  const { text, image } = body;
  const prisma = getPrisma(c.env.DB);
  const msg = await prisma.directMessage.create({
    data: {
      chatId,
      senderId,
      text: text || "",
      image: image || null
    },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } }
    }
  });
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
    select: { user1Id: true, user2Id: true }
  });
  if (chat) {
    const recipientId = chat.user1Id === senderId ? chat.user2Id : chat.user1Id;
    const senderDetails = await prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, username: true } });
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    await dispatchNotification({
      prisma,
      userId: recipientId,
      title: "New Message",
      message: `${senderDetails?.firstName || senderDetails?.username || "Someone"} sent you a message.`,
      type: "CHAT_MESSAGE",
      pushSettingKey: "pushDirectMessages",
      fcm,
      data: { type: "CHAT_MESSAGE", chatId }
    });
  }
  return c.json(msg);
});
chats.delete("/:chatId/messages/:messageId", async (c) => {
  const userId = c.get("userId");
  const messageId = c.req.param("messageId");
  const prisma = getPrisma(c.env.DB);
  const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  if (msg.senderId !== userId) return c.json({ error: "Forbidden" }, 403);
  await prisma.directMessage.delete({ where: { id: messageId } });
  return c.json({ message: "Message deleted successfully" });
});
chats.delete("/:chatId/clear", async (c) => {
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");
  const prisma = getPrisma(c.env.DB);
  const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
  if (!chat || chat.user1Id !== userId && chat.user2Id !== userId) {
    return c.json({ error: "Chat not found or forbidden" }, 404);
  }
  const clearRecord = await prisma.chatClear.upsert({
    where: {
      chatId_userId: { chatId, userId }
    },
    update: {
      clearedAt: /* @__PURE__ */ new Date()
    },
    create: {
      chatId,
      userId,
      clearedAt: /* @__PURE__ */ new Date()
    }
  });
  return c.json({ message: "Chat cleared successfully", clearRecord });
});
chats.post("/:chatId/pin", async (c) => {
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");
  const prisma = getPrisma(c.env.DB);
  const pin = await prisma.chatPin.create({
    data: { chatId, userId }
  });
  return c.json(pin);
});
chats.post("/:chatId/unpin", async (c) => {
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");
  const prisma = getPrisma(c.env.DB);
  await prisma.chatPin.deleteMany({
    where: { chatId, userId }
  });
  return c.json({ message: "Chat unpinned successfully" });
});
chats.put("/:chatId/read", async (c) => {
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");
  const prisma = getPrisma(c.env.DB);
  const updated = await prisma.directMessage.updateMany({
    where: {
      chatId,
      senderId: { not: userId },
      isRead: false
    },
    data: {
      isRead: true
    }
  });
  return c.json({ message: "Marked as read", count: updated.count });
});
chats.get("/pins/list", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const pins = await prisma.chatPin.findMany({
    where: { userId },
    include: {
      chat: {
        include: {
          user1: { select: { id: true, username: true, avatarUrl: true } },
          user2: { select: { id: true, username: true, avatarUrl: true } }
        }
      }
    }
  });
  return c.json(pins.map((p: any) => p.chat));
});
chats.get("/profiles/recent", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.directChat.findMany({
    where: {
      OR: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    },
    include: {
      user1: { select: { id: true, username: true, avatarUrl: true } },
      user2: { select: { id: true, username: true, avatarUrl: true } }
    },
    take: 10
  });
  return c.json(list.map((c2: any) => c2.user1Id === userId ? c2.user2 : c2.user1));
});


export default chats;
