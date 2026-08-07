
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq } from 'drizzle-orm';
import { question } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

import { Bindings, Variables } from '../types';

var questionsRouter = new Hono<{Bindings: Bindings, Variables: Variables}>();
questionsRouter.use("*", authMiddleware);

questionsRouter.get("/", async (c) => {
  const db = getDrizzle(c.env.DB);
  const list = await db.query.question.findMany({
    limit: 50
  });
  const formatted = list.map((q: any) => ({
    ...q,
    options: JSON.parse(q.options || '[]')
  }));
  return c.json(formatted);
});

questionsRouter.get("/packs/weekly", async (c) => {
  return c.json([
    { id: "week-1", name: "Fresh Manna: Week 1", questionsCount: 5, difficulty: "Easy" },
    { id: "week-2", name: "Fresh Manna: Week 2", questionsCount: 5, difficulty: "Medium" }
  ]);
});

questionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  const questionRes = await db.query.question.findFirst({
    where: eq(question.id, id)
  });
  if (!questionRes) return c.json({ error: "Question not found" }, 404);
  return c.json({
    ...questionRes,
    options: JSON.parse(questionRes.options || '[]')
  });
});

questionsRouter.post("/", async (c) => {
  const body = await c.req.json() as any;
  const { quizId, questionText, options, correctAnswerIndex, points } = body;
  const db = getDrizzle(c.env.DB);
  
  const [newQuestion] = await db.insert(question).values({
    id: crypto.randomUUID(),
    quizId,
    questionText,
    options: JSON.stringify(options || []),
    correctAnswerIndex,
    points: points || 10
  }).returning();
  
  return c.json(newQuestion);
});

questionsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { questionText, options, correctAnswerIndex, points } = body;
  const db = getDrizzle(c.env.DB);
  
  const updateData: any = {};
  if (questionText !== undefined) updateData.questionText = questionText;
  if (options !== undefined) updateData.options = JSON.stringify(options);
  if (correctAnswerIndex !== undefined) updateData.correctAnswerIndex = correctAnswerIndex;
  if (points !== undefined) updateData.points = points;
  
  const [updated] = await db.update(question)
    .set(updateData)
    .where(eq(question.id, id))
    .returning();
    
  return c.json(updated);
});

export default questionsRouter;
