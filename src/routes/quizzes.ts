
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, sql, desc, and } from 'drizzle-orm';
import { 
  quiz, 
  question, 
  quizAttempt, 
  user 
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { grantCoinsDrizzle as grantCoins } from '../utils/economy';

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
  const db = getDrizzle(c.env.DB);
  const category = c.req.query("category");
  const difficulty = c.req.query("difficulty");
  
  let conditions = [];
  if (category) conditions.push(eq(quiz.category, category));
  if (difficulty) conditions.push(eq(quiz.difficulty, difficulty));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const list = await db.query.quiz.findMany({
    where: whereClause,
    with: {
      questions: true
    }
  });
  
  if (list.length === 0) {
    const newQuizId = crypto.randomUUID();
    const [defaultQuiz] = await db.insert(quiz).values({
      id: newQuizId,
      title: "Gospels Basics",
      category: "gospels",
      difficulty: "easy",
      points: 50,
    }).returning();
    
    await db.insert(question).values([
      {
        id: crypto.randomUUID(),
        quizId: newQuizId,
        questionText: "How many books are in the Gospels?",
        options: JSON.stringify(["3", "4", "5", "6"]),
        correctAnswerIndex: 1,
        points: 10
      },
      {
        id: crypto.randomUUID(),
        quizId: newQuizId,
        questionText: "Who wrote the Gospel of Luke?",
        options: JSON.stringify(["Luke", "Matthew", "Mark", "John"]),
        correctAnswerIndex: 0,
        points: 10
      }
    ]);
    
    const fetchedQuiz = await db.query.quiz.findFirst({
      where: eq(quiz.id, newQuizId),
      with: {
        questions: true
      }
    });
    
    if (fetchedQuiz) {
      const formatted = {
        ...fetchedQuiz,
        questions: fetchedQuiz.questions.map((qn: any) => ({
          ...qn,
          options: JSON.parse(qn.options)
        }))
      };
      return c.json([formatted]);
    }
    return c.json([]);
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
  const db = getDrizzle(c.env.DB);
  
  const quizObj = await db.query.quiz.findFirst({
    where: eq(quiz.id, quizId),
    with: { questions: true }
  });
  
  if (!quizObj) {
    return c.json({ error: "Quiz not found" }, 404);
  }
  return c.json({
    ...quizObj,
    questions: quizObj.questions.map((qn: any) => ({
      ...qn,
      options: JSON.parse(qn.options)
    }))
  });
});

quizzes.post("/solo/:quizId/start", async (c) => {
  const quizId = c.req.param("quizId");
  const db = getDrizzle(c.env.DB);
  const quizObj = await db.query.quiz.findFirst({ where: eq(quiz.id, quizId) });
  if (!quizObj) return c.json({ error: "Quiz not found" }, 404);
  return c.json({
    message: "Quiz session started",
    quizId,
    startTime: new Date().toISOString()
  });
});

quizzes.post("/solo/:quizId/submit", async (c) => {
  const userId = c.get("userId") as string;
  const quizId = c.req.param("quizId");
  const body = await c.req.json() as any;
  const { answers } = body;
  const db = getDrizzle(c.env.DB);
  
  const quizObj = await db.query.quiz.findFirst({
    where: eq(quiz.id, quizId),
    with: { questions: true }
  });
  
  if (!quizObj) return c.json({ error: "Quiz not found" }, 404);
  let score = 0;
  let pointsEarned = 0;
  
  quizObj.questions.forEach((q: any) => {
    const parsedOptions = JSON.parse(q.options);
    const sub = (answers || []).find((a: any) => a.questionId === q.id);
    if (sub && sub.selectedIndex === q.correctAnswerIndex) {
      score += 1;
      pointsEarned += q.points;
    }
  });
  pointsEarned += quizObj.points;
  
  const [attempt] = await db.insert(quizAttempt).values({
    id: crypto.randomUUID(),
    userId,
    quizId,
    score,
    pointsEarned,
    completedAt: sql`CURRENT_TIMESTAMP`
  }).returning();
  
  await db.update(user).set({
    points: sql`${user.points} + ${pointsEarned}`,
    quizPoints: sql`${user.quizPoints} + ${pointsEarned}`
  }).where(eq(user.id, userId));

  const coinRes = await grantCoins(db, userId, pointsEarned, "Completed a Quiz");

  return c.json({
    message: "Quiz submitted successfully",
    attempt,
    questionsCount: quizObj.questions.length,
    correctAnswers: score,
    pointsEarned,
    coinBalance: coinRes.newBalance
  });
});

quizzes.get("/solo/:quizId/result", async (c) => {
  const userId = c.get("userId") as string;
  const quizId = c.req.param("quizId");
  const db = getDrizzle(c.env.DB);
  
  const attempt = await db.query.quizAttempt.findFirst({
    where: and(eq(quizAttempt.userId, userId), eq(quizAttempt.quizId, quizId)),
    orderBy: [desc(quizAttempt.completedAt)]
  });
  
  if (!attempt) {
    return c.json({ error: "No attempts found for this quiz" }, 404);
  }
  return c.json(attempt);
});

quizzes.get("/solo/history", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const history = await db.query.quizAttempt.findMany({
    where: eq(quizAttempt.userId, userId),
    with: { quiz: true },
    orderBy: [desc(quizAttempt.completedAt)]
  });
  return c.json(history);
});

quizzes.get("/solo/leaderboard", async (c) => {
  const db = getDrizzle(c.env.DB);
  
  const usersList = await db.select({
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    points: user.points
  })
  .from(user)
  .orderBy(desc(user.points))
  .limit(20);
  
  return c.json(usersList);
});

export default quizzes;
