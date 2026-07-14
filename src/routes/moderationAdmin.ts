import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/moderationAdmin.ts
import { Bindings, Variables } from '../types';
var moderationAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
moderationAdmin.get("/reports", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const reports = await prisma.postReport.findMany({
    include: {
      post: { select: { text: true, userId: true } },
      user: { select: { username: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ reports });
});
moderationAdmin.delete("/reports/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.postReport.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
moderationAdmin.delete("/posts/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.post.delete({ where: { id: c.req.param("id") } });
  await prisma.postReport.deleteMany({ where: { postId: c.req.param("id") } });
  return c.json({ success: true });
});
moderationAdmin.get("/chat-clears", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const clears = await prisma.chatClear.findMany({
    include: { user: { select: { username: true } } },
    orderBy: { clearedAt: "desc" }
  });
  return c.json({ clears });
});


export default moderationAdmin;
