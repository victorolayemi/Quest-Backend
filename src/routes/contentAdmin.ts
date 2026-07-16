import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/contentAdmin.ts
import { Bindings, Variables } from '../types';
var contentAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
contentAdmin.get("/devotions/plans", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const plans = await prisma.devotionPlan.findMany({
    include: { _count: { select: { days: true } } }
  });
  return c.json({ plans });
});
contentAdmin.post("/devotions/plans", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const plan = await prisma.devotionPlan.create({ data: body });
  return c.json({ plan });
});
contentAdmin.delete("/devotions/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.devotionPlan.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.put("/devotions/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  // Strip computed/readonly fields that Prisma rejects
  const { _count, id, createdAt, days, ...data } = body;
  const plan = await prisma.devotionPlan.update({
    where: { id: c.req.param("id") },
    data
  });
  return c.json({ plan });
});
contentAdmin.get("/devotions/plans/:planId/days", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const days = await prisma.devotionDay.findMany({
    where: { planId: c.req.param("planId") },
    orderBy: { dayNumber: "asc" }
  });
  return c.json({ days });
});
contentAdmin.post("/devotions/days", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const day2 = await prisma.devotionDay.create({ data: body });
  return c.json({ day: day2 });
});
contentAdmin.delete("/devotions/days/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.devotionDay.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.put("/devotions/days/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const day2 = await prisma.devotionDay.update({
    where: { id: c.req.param("id") },
    data: body
  });
  return c.json({ day: day2 });
});
contentAdmin.post("/devotions/bulk-import", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const plansData = body.plans;

  if (!Array.isArray(plansData)) {
    return c.json({ error: "Invalid data format" }, 400);
  }

  const createdPlans = [];
  for (const p of plansData) {
    const { days, ...planData } = p;
    const plan = await prisma.devotionPlan.create({
      data: {
        ...planData,
        days: {
          create: days
        }
      }
    });
    createdPlans.push(plan);
  }

  return c.json({ success: true, created: createdPlans.length });
});
contentAdmin.get("/daily-bread", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const breads = await prisma.dailyBread.findMany({ orderBy: { date: "desc" } });
  return c.json({ breads });
});
contentAdmin.post("/daily-bread", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const bread = await prisma.dailyBread.create({ data: body });
  return c.json({ bread });
});
contentAdmin.delete("/daily-bread/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.dailyBread.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/affirmations", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const affirmations = await prisma.affirmation.findMany({ orderBy: { createdAt: "desc" } });
  return c.json({ affirmations });
});
contentAdmin.post("/affirmations", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const affirmation = await prisma.affirmation.create({ data: body });
  return c.json({ affirmation });
});
contentAdmin.delete("/affirmations/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.affirmation.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/books", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const books2 = await prisma.book.findMany({ orderBy: { createdAt: "desc" } });
  return c.json({ books: books2 });
});
contentAdmin.post("/books", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const book = await prisma.book.create({ data: body });
  return c.json({ book });
});
contentAdmin.delete("/books/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.book.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/media", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const media2 = await prisma.sermonMedia.findMany({ orderBy: { createdAt: "desc" } });
  const userMedia = await prisma.userMedia.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
  const uMapped = userMedia.map(m => ({
    id: m.id,
    title: m.title,
    author: m.user ? `${m.user.firstName} ${m.user.lastName}` : 'Unknown',
    mediaUrl: m.mediaUrl,
    imageUrl: "",
    type: m.type,
    duration: "00:00",
    category: "Reel",
    createdAt: m.createdAt
  }));
  const all = [...media2, ...uMapped].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return c.json({ media: all });
});
contentAdmin.post("/media", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const media2 = await prisma.sermonMedia.create({ data: body });
  return c.json({ media: media2 });
});
contentAdmin.delete("/media/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    await prisma.sermonMedia.delete({ where: { id } });
  } catch (e) {
    try {
      await prisma.userMedia.delete({ where: { id } });
    } catch (e2) {
      // Ignore if not found
    }
  }
  return c.json({ success: true });
});


export default contentAdmin;
