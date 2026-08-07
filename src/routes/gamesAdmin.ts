import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc } from 'drizzle-orm';
import { wordMatchQuestion, wordCrossQuestion, bibleQuizQuestion, gameSettings } from '../db/schema';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { Bindings, Variables } from '../types';

var gamesAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();

gamesAdmin.use("*", adminAuthMiddleware);

gamesAdmin.get("/word-match", async (c) => {
  const db = getDrizzle(c.env.DB);
  const questions = await db.query.wordMatchQuestion.findMany({
    orderBy: [desc(wordMatchQuestion.createdAt)]
  });
  return c.json({ questions });
});

gamesAdmin.post("/word-match", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { word, match: match2, difficulty } = body;
    const [question] = await db.insert(wordMatchQuestion).values({
      id: crypto.randomUUID(),
      word, match: match2, difficulty: difficulty || "easy"
    }).returning();
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});

gamesAdmin.put("/word-match/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { word, match: match2, difficulty } = body;
    const updateData: any = {};
    if (word !== undefined) updateData.word = word;
    if (match2 !== undefined) updateData.match = match2;
    if (difficulty !== undefined) updateData.difficulty = difficulty;

    const [question] = await db.update(wordMatchQuestion).set(updateData).where(eq(wordMatchQuestion.id, c.req.param("id") as string)).returning();
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});

gamesAdmin.delete("/word-match/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    await db.delete(wordMatchQuestion).where(eq(wordMatchQuestion.id, c.req.param("id") as string));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});

gamesAdmin.post("/word-match/bulk", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Invalid data format" }, 400);

    const valuesToInsert = questions.map(q => ({
      id: crypto.randomUUID(),
      word: q.word,
      match: q.match,
      difficulty: q.difficulty || "easy"
    }));

    let imported = 0;
    if (valuesToInsert.length > 0) {
      await db.insert(wordMatchQuestion).values(valuesToInsert);
      imported = valuesToInsert.length;
    }
    
    return c.json({ message: `Successfully imported ${imported} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});

gamesAdmin.get("/word-cross", async (c) => {
  const db = getDrizzle(c.env.DB);
  const questions = await db.query.wordCrossQuestion.findMany({
    orderBy: [desc(wordCrossQuestion.createdAt)]
  });
  return c.json({ questions });
});

gamesAdmin.post("/word-cross", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { word, clue, difficulty } = body;
    const [question] = await db.insert(wordCrossQuestion).values({
      id: crypto.randomUUID(),
      word, clue, difficulty: difficulty || "easy"
    }).returning();
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});

gamesAdmin.put("/word-cross/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { word, clue, difficulty } = body;
    const updateData: any = {};
    if (word !== undefined) updateData.word = word;
    if (clue !== undefined) updateData.clue = clue;
    if (difficulty !== undefined) updateData.difficulty = difficulty;

    const [question] = await db.update(wordCrossQuestion).set(updateData).where(eq(wordCrossQuestion.id, c.req.param("id") as string)).returning();
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});

gamesAdmin.delete("/word-cross/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    await db.delete(wordCrossQuestion).where(eq(wordCrossQuestion.id, c.req.param("id") as string));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});

gamesAdmin.post("/word-cross/bulk", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Invalid data format" }, 400);

    const valuesToInsert = questions.map(q => ({
      id: crypto.randomUUID(),
      word: q.word,
      clue: q.clue,
      difficulty: q.difficulty || "easy"
    }));

    if (valuesToInsert.length > 0) {
      await db.insert(wordCrossQuestion).values(valuesToInsert);
    }
    
    return c.json({ message: `Successfully imported ${valuesToInsert.length} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});

gamesAdmin.get("/bible-quiz", async (c) => {
  const db = getDrizzle(c.env.DB);
  const questions = await db.query.bibleQuizQuestion.findMany({
    orderBy: [desc(bibleQuizQuestion.createdAt)]
  });
  const mapped = questions.map(q => ({
    ...q,
    options: typeof q.options === "string" ? JSON.parse(q.options) : q.options
  }));
  return c.json({ questions: mapped });
});

gamesAdmin.post("/bible-quiz", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { questionText, options, correctAnswerIndex, level } = body;
    const [question] = await db.insert(bibleQuizQuestion).values({
      id: crypto.randomUUID(),
      questionText,
      options: typeof options === "string" ? options : JSON.stringify(options),
      correctAnswerIndex: parseInt(correctAnswerIndex, 10),
      level: level ? parseInt(level, 10) : 1
    }).returning();
    const parsed = {
      ...question,
      options: typeof question.options === "string" ? JSON.parse(question.options) : question.options
    };
    return c.json({ question: parsed });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});

gamesAdmin.put("/bible-quiz/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { questionText, options, correctAnswerIndex, level } = body;
    
    const updateData: any = {};
    if (questionText !== undefined) updateData.questionText = questionText;
    if (options !== undefined) updateData.options = typeof options === "string" ? options : JSON.stringify(options);
    if (correctAnswerIndex !== undefined) updateData.correctAnswerIndex = parseInt(correctAnswerIndex, 10);
    if (level !== undefined) updateData.level = parseInt(level, 10);

    const [question] = await db.update(bibleQuizQuestion).set(updateData).where(eq(bibleQuizQuestion.id, c.req.param("id") as string)).returning();
    const parsed = {
      ...question,
      options: typeof question.options === "string" ? JSON.parse(question.options) : question.options
    };
    return c.json({ question: parsed });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});

gamesAdmin.delete("/bible-quiz/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    await db.delete(bibleQuizQuestion).where(eq(bibleQuizQuestion.id, c.req.param("id") as string));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});

gamesAdmin.post("/bible-quiz/bulk", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Invalid format" }, 400);

    const valuesToInsert = questions.map(q => ({
      id: crypto.randomUUID(),
      questionText: q.questionText,
      options: typeof q.options === "string" ? q.options : JSON.stringify(q.options),
      correctAnswerIndex: parseInt(q.correctAnswerIndex, 10),
      level: q.level ? parseInt(q.level, 10) : 1
    }));

    if (valuesToInsert.length > 0) {
      await db.insert(bibleQuizQuestion).values(valuesToInsert);
    }
    return c.json({ message: `Successfully imported ${valuesToInsert.length} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});

gamesAdmin.get("/settings", async (c) => {
  const db = getDrizzle(c.env.DB);
  const settings = await db.query.gameSettings.findMany();
  return c.json({ settings });
});

gamesAdmin.post("/settings", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = await c.req.json() as any;
    const { gameType, totalQuestions, durationSecs } = body;

    const existing = await db.query.gameSettings.findFirst({
      where: eq(gameSettings.gameType, gameType)
    });

    let setting;
    if (existing) {
      const [updated] = await db.update(gameSettings)
        .set({ totalQuestions, durationSecs })
        .where(eq(gameSettings.gameType, gameType))
        .returning();
      setting = updated;
    } else {
      const [inserted] = await db.insert(gameSettings)
        .values({ id: crypto.randomUUID(), gameType, totalQuestions, durationSecs })
        .returning();
      setting = inserted;
    }
    
    return c.json({ setting });
  } catch (error) {
    return c.json({ error: "Failed to save settings" }, 500);
  }
});

export default gamesAdmin;
