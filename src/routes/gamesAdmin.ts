import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/gamesAdmin.ts
import { Bindings, Variables } from '../types';
var gamesAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
gamesAdmin.use("*", adminAuthMiddleware);
gamesAdmin.get("/word-match", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const questions = await prisma.wordMatchQuestion.findMany({
      orderBy: { createdAt: "desc" }
    });
    return c.json({ questions });
  } catch (error) {
    return c.json({ error: "Failed to fetch questions" }, 500);
  }
});
gamesAdmin.post("/word-match", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { word, match: match2, difficulty } = body;
    const question = await prisma.wordMatchQuestion.create({
      data: { word, match: match2, difficulty: difficulty || "easy" }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});
gamesAdmin.put("/word-match/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { word, match: match2, difficulty } = body;
    const question = await prisma.wordMatchQuestion.update({
      where: { id },
      data: { word, match: match2, difficulty }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});
gamesAdmin.delete("/word-match/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    await prisma.wordMatchQuestion.delete({ where: { id } });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});
gamesAdmin.post("/word-match/bulk-import", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Expected an array of questions" }, 400);
    let imported = 0;
    for (const q of questions) {
      if (q.word && q.match) {
        await prisma.wordMatchQuestion.create({
          data: {
            word: q.word,
            match: q.match,
            difficulty: q.difficulty || "easy"
          }
        });
        imported++;
      }
    }
    return c.json({ message: `Successfully imported ${imported} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});
gamesAdmin.post("/word-match/bulk-delete", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { ids } = body;
    if (!Array.isArray(ids)) return c.json({ error: "Expected an array of ids" }, 400);
    await prisma.wordMatchQuestion.deleteMany({
      where: { id: { in: ids } }
    });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to bulk delete questions" }, 500);
  }
});
gamesAdmin.get("/word-cross", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const questions = await prisma.wordCrossQuestion.findMany({
      orderBy: { createdAt: "desc" }
    });
    return c.json({ questions });
  } catch (error) {
    return c.json({ error: "Failed to fetch questions" }, 500);
  }
});
gamesAdmin.post("/word-cross", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { word, clue, difficulty } = body;
    const question = await prisma.wordCrossQuestion.create({
      data: { word, clue, difficulty: difficulty || "easy" }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});
gamesAdmin.put("/word-cross/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { word, clue, difficulty } = body;
    const question = await prisma.wordCrossQuestion.update({
      where: { id },
      data: { word, clue, difficulty }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});
gamesAdmin.delete("/word-cross/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    await prisma.wordCrossQuestion.delete({ where: { id } });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});
gamesAdmin.post("/word-cross/bulk-import", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Expected an array of questions" }, 400);
    let imported = 0;
    for (const q of questions) {
      if (q.word && q.clue) {
        await prisma.wordCrossQuestion.create({
          data: {
            word: q.word,
            clue: q.clue,
            difficulty: q.difficulty || "easy"
          }
        });
        imported++;
      }
    }
    return c.json({ message: `Successfully imported ${imported} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});
gamesAdmin.post("/word-cross/bulk-delete", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { ids } = body;
    if (!Array.isArray(ids)) return c.json({ error: "Expected an array of ids" }, 400);
    await prisma.wordCrossQuestion.deleteMany({
      where: { id: { in: ids } }
    });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to bulk delete questions" }, 500);
  }
});
gamesAdmin.get("/bible-quiz", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const questions = await prisma.bibleQuizQuestion.findMany({
      orderBy: { createdAt: "desc" }
    });
    return c.json({ questions });
  } catch (error) {
    return c.json({ error: "Failed to fetch questions" }, 500);
  }
});
gamesAdmin.post("/bible-quiz", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { questionText, options, correctAnswerIndex, level } = body;
    const question = await prisma.bibleQuizQuestion.create({
      data: {
        questionText,
        options: typeof options === "string" ? options : JSON.stringify(options),
        correctAnswerIndex: parseInt(correctAnswerIndex, 10),
        level: level ? parseInt(level, 10) : 1
      }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to create question" }, 500);
  }
});
gamesAdmin.put("/bible-quiz/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { questionText, options, correctAnswerIndex, level } = body;
    const question = await prisma.bibleQuizQuestion.update({
      where: { id },
      data: {
        questionText,
        options: typeof options === "string" ? options : JSON.stringify(options),
        correctAnswerIndex: parseInt(correctAnswerIndex, 10),
        level: level ? parseInt(level, 10) : 1
      }
    });
    return c.json({ question });
  } catch (error) {
    return c.json({ error: "Failed to update question" }, 500);
  }
});
gamesAdmin.delete("/bible-quiz/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    await prisma.bibleQuizQuestion.delete({ where: { id } });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to delete question" }, 500);
  }
});
gamesAdmin.post("/bible-quiz/bulk-import", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { questions } = body;
    if (!Array.isArray(questions)) return c.json({ error: "Expected an array of questions" }, 400);
    let imported = 0;
    for (const q of questions) {
      if (q.questionText && q.options && q.correctAnswerIndex !== void 0) {
        await prisma.bibleQuizQuestion.create({
          data: {
            questionText: q.questionText,
            options: typeof q.options === "string" ? q.options : JSON.stringify(q.options),
            correctAnswerIndex: parseInt(q.correctAnswerIndex, 10),
            level: q.level ? parseInt(q.level, 10) : 1
          }
        });
        imported++;
      }
    }
    return c.json({ message: `Successfully imported ${imported} questions` });
  } catch (error) {
    return c.json({ error: "Failed to bulk import questions" }, 500);
  }
});
gamesAdmin.post("/bible-quiz/bulk-delete", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { ids } = body;
    if (!Array.isArray(ids)) return c.json({ error: "Expected an array of ids" }, 400);
    await prisma.bibleQuizQuestion.deleteMany({
      where: { id: { in: ids } }
    });
    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to bulk delete questions" }, 500);
  }
});
gamesAdmin.get("/settings", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const settings = await prisma.gameSettings.findMany();
    return c.json({ settings });
  } catch (error) {
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});
gamesAdmin.put("/settings", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { gameType, totalQuestions, durationSecs } = body;
    const setting = await prisma.gameSettings.upsert({
      where: { gameType },
      update: { totalQuestions, durationSecs },
      create: { gameType, totalQuestions, durationSecs }
    });
    return c.json({ setting });
  } catch (error) {
    return c.json({ error: "Failed to update settings" }, 500);
  }
});


export default gamesAdmin;
