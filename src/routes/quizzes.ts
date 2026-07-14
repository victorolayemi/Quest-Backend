import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/quizzes.ts
import { Bindings, Variables } from '../types';
var quizzes = new Hono<{Bindings: Bindings, Variables: Variables}>();
quizzes.use("*", authMiddleware);
quizzes.get("/solo/categories", async (c) => {
  return c.json([
    { id: "gospels", name: "Gospels", count: 5 },
    { id: "prophets", name: "Prophets", count: 3 },
    { id: "epistles", name: "Epistles", count: 4 },
    { id: "genesis", name: "Genesis", count: 2 }
  ]);
});
quizzes.get("/solo/difficulties", async (c) => {
  return c.json([
    { id: "easy", name: "Easy", multiplier: 1 },
    { id: "medium", name: "Medium", multiplier: 1.5 },
    { id: "hard", name: "Hard", multiplier: 2 }
  ]);
});
quizzes.get("/solo", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const category = c.req.query("category");
  const difficulty = c.req.query("difficulty");
  const list = await prisma.quiz.findMany({
    where: {
      category: category || void 0,
      difficulty: difficulty || void 0
    },
    include: {
      questions: true
    }
  });
  if (list.length === 0) {
    const defaultQuiz = await prisma.quiz.create({
      data: {
        title: "Gospels Basics",
        category: "gospels",
        difficulty: "easy",
        points: 50,
        questions: {
          create: [
            {
              questionText: "How many books are in the Gospels?",
              options: JSON.stringify(["3", "4", "5", "6"]),
              correctAnswerIndex: 1,
              // '4'
              points: 10
            },
            {
              questionText: "Who wrote the Gospel of Luke?",
              options: JSON.stringify(["Luke", "Matthew", "Mark", "John"]),
              correctAnswerIndex: 0,
              points: 10
            }
          ]
        }
      },
      include: {
        questions: true
      }
    });
    return c.json([defaultQuiz]);
  }
  const formatted = list.map((q: any) => ({
    ...q,
    questions: q.questions.map((qn: any) => ({
      ...qn,
      options: JSON.parse(qn.options)
    }))
  }));
  return c.json(formatted);
});
quizzes.get("/solo/:quizId", async (c) => {
  const quizId = c.req.param("quizId");
  const prisma = getPrisma(c.env.DB);
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: true }
  });
  if (!quiz) {
    return c.json({ error: "Quiz not found" }, 404);
  }
  return c.json({
    ...quiz,
    questions: quiz.questions.map((qn: any) => ({
      ...qn,
      options: JSON.parse(qn.options)
    }))
  });
});
quizzes.post("/solo/:quizId/start", async (c) => {
  const quizId = c.req.param("quizId");
  const prisma = getPrisma(c.env.DB);
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);
  return c.json({
    message: "Quiz session started",
    quizId,
    startTime: /* @__PURE__ */ new Date()
  });
});
quizzes.post("/solo/:quizId/submit", async (c) => {
  const userId = c.get("userId");
  const quizId = c.req.param("quizId");
  const body = await c.req.json();
  const { answers } = body;
  const prisma = getPrisma(c.env.DB);
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: true }
  });
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);
  let score = 0;
  let pointsEarned = 0;
  quiz.questions.forEach((q: any) => {
    const parsedOptions = JSON.parse(q.options);
    const sub = (answers || []).find((a: any) => a.questionId === q.id);
    if (sub && sub.selectedIndex === q.correctAnswerIndex) {
      score += 1;
      pointsEarned += q.points;
    }
  });
  pointsEarned += quiz.points;
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      quizId,
      score,
      pointsEarned
    }
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: pointsEarned }
    }
  });
  return c.json({
    message: "Quiz submitted successfully",
    attempt,
    questionsCount: quiz.questions.length,
    correctAnswers: score,
    pointsEarned
  });
});
quizzes.get("/solo/:quizId/result", async (c) => {
  const userId = c.get("userId");
  const quizId = c.req.param("quizId");
  const prisma = getPrisma(c.env.DB);
  const attempt = await prisma.quizAttempt.findFirst({
    where: { userId, quizId },
    orderBy: { completedAt: "desc" }
  });
  if (!attempt) {
    return c.json({ error: "No attempts found for this quiz" }, 404);
  }
  return c.json(attempt);
});
quizzes.get("/solo/history", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const history = await prisma.quizAttempt.findMany({
    where: { userId },
    include: { quiz: true },
    orderBy: { completedAt: "desc" }
  });
  return c.json(history);
});
quizzes.get("/solo/leaderboard", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const usersList = await prisma.user.findMany({
    orderBy: { points: "desc" },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      points: true
    },
    take: 20
  });
  return c.json(usersList);
});


export default quizzes;
