import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/gamificationAdmin.ts
import { Bindings, Variables } from '../types';
var gamificationAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
gamificationAdmin.get("/quizzes", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const quizzes2 = await prisma.quiz.findMany({
    include: { _count: { select: { questions: true } } }
  });
  return c.json({ quizzes: quizzes2 });
});
gamificationAdmin.post("/quizzes", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const quiz = await prisma.quiz.create({ data: body });
  return c.json({ quiz });
});
gamificationAdmin.delete("/quizzes/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.quiz.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
gamificationAdmin.get("/badges", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const badges2 = await prisma.badge.findMany();
  return c.json({ badges: badges2 });
});
gamificationAdmin.post("/badges", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const badge = await prisma.badge.create({ data: body });
  return c.json({ badge });
});
gamificationAdmin.delete("/badges/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.badge.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});


export default gamificationAdmin;
