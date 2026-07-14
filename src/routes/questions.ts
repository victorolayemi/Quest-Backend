import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/questions.ts
import { Bindings, Variables } from '../types';
var questionsRouter = new Hono<{Bindings: Bindings, Variables: Variables}>();
questionsRouter.use("*", authMiddleware);
questionsRouter.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.question.findMany({
    take: 50
  });
  const formatted = list.map((q: any) => ({
    ...q,
    options: JSON.parse(q.options)
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
  const prisma = getPrisma(c.env.DB);
  const question = await prisma.question.findUnique({
    where: { id }
  });
  if (!question) return c.json({ error: "Question not found" }, 404);
  return c.json({
    ...question,
    options: JSON.parse(question.options)
  });
});
questionsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { quizId, questionText, options, correctAnswerIndex, points } = body;
  const prisma = getPrisma(c.env.DB);
  const newQuestion = await prisma.question.create({
    data: {
      quizId,
      questionText,
      options: JSON.stringify(options),
      correctAnswerIndex,
      points: points || 10
    }
  });
  return c.json(newQuestion);
});
questionsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { questionText, options, correctAnswerIndex, points } = body;
  const prisma = getPrisma(c.env.DB);
  const updated = await prisma.question.update({
    where: { id },
    data: {
      questionText: questionText || void 0,
      options: options ? JSON.stringify(options) : void 0,
      correctAnswerIndex: correctAnswerIndex !== void 0 ? correctAnswerIndex : void 0,
      points: points !== void 0 ? points : void 0
    }
  });
  return c.json(updated);
});


export default questionsRouter;
