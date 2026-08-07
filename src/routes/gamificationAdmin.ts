import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, sql } from 'drizzle-orm';
import { quiz, badge, question } from '../db/schema';
import { Bindings, Variables } from '../types';

var gamificationAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
gamificationAdmin.get("/quizzes", async (c) => {
  const db = getDrizzle(c.env.DB);
  const quizzesData = await db.query.quiz.findMany({});

  const formattedQuizzes = await Promise.all(quizzesData.map(async (q) => {
    const [qc] = await db.select({ count: sql<number>`count(*)` }).from(question).where(eq(question.quizId, q.id));
    return {
      ...q,
      _count: {
        questions: Number(qc.count)
      }
    };
  }));

  return c.json({ quizzes: formattedQuizzes });
});
gamificationAdmin.post("/quizzes", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [newQuiz] = await db.insert(quiz).values(body).returning();
  return c.json({ quiz: newQuiz });
});
gamificationAdmin.delete("/quizzes/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(quiz).where(eq(quiz.id, c.req.param("id") as string));
  return c.json({ success: true });
});
gamificationAdmin.get("/badges", async (c) => {
  const db = getDrizzle(c.env.DB);
  const badges2 = await db.query.badge.findMany();
  return c.json({ badges: badges2 });
});
gamificationAdmin.post("/badges", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [newBadge] = await db.insert(badge).values(body).returning();
  return c.json({ badge: newBadge });
});
gamificationAdmin.delete("/badges/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(badge).where(eq(badge.id, c.req.param("id") as string));
  return c.json({ success: true });
});

export default gamificationAdmin;
