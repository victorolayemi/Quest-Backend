import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { grantCoins } from '../utils/economy';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/games.ts
import { Bindings, Variables } from '../types';
var games = new Hono<{Bindings: Bindings, Variables: Variables}>();
games.get("/play/word-match", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const difficulty = c.req.query("difficulty") || "easy";
  try {
    const settings = await prisma.gameSettings.findUnique({ where: { gameType: "WORD_MATCH" } });
    const limit = settings?.totalQuestions || 10;
    const allQuestions = await prisma.wordMatchQuestion.findMany({
      where: { difficulty }
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    return c.json({ questions: selected, durationSecs: settings?.durationSecs || 60, totalQuestions: limit });
  } catch (error) {
    return c.json({ error: "Failed to fetch word match questions" }, 500);
  }
});
games.get("/play/word-cross", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const difficulty = c.req.query("difficulty") || "easy";
  try {
    const settings = await prisma.gameSettings.findUnique({ where: { gameType: "WORD_CROSS" } });
    const limit = settings?.totalQuestions || 10;
    const allQuestions = await prisma.wordCrossQuestion.findMany({
      where: { difficulty }
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    return c.json({ questions: selected, durationSecs: settings?.durationSecs || 60, totalQuestions: limit });
  } catch (error) {
    return c.json({ error: "Failed to fetch word cross questions" }, 500);
  }
});
games.get("/play/bible-quiz/max-level", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const maxLevelRow = await prisma.bibleQuizQuestion.aggregate({
      _max: { level: true }
    });
    return c.json({ maxLevel: maxLevelRow._max.level || 1 });
  } catch (error) {
    return c.json({ error: "Failed to fetch max level" }, 500);
  }
});
games.get("/play/bible-quiz", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const levelStr = c.req.query("level") || "1";
  const level = parseInt(levelStr, 10) || 1;
  try {
    const settings = await prisma.gameSettings.findUnique({ where: { gameType: "BIBLE_QUIZ" } });
    const limit = settings?.totalQuestions || 10;
    const allQuestions = await prisma.bibleQuizQuestion.findMany({
      where: { level }
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    const maxLevelRow = await prisma.bibleQuizQuestion.aggregate({
      _max: { level: true }
    });
    const maxLevel = maxLevelRow._max.level || 1;
    return c.json({ questions: selected, durationSecs: settings?.durationSecs || 60, totalQuestions: limit, maxLevel });
  } catch (error) {
    return c.json({ error: "Failed to fetch bible quiz questions" }, 500);
  }
});
games.post("/score", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    const { userId, gameType, difficulty, level, score } = body;
    if (!userId || !gameType || difficulty === void 0 && level === void 0 || score === void 0) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    const savedScore = await prisma.gameScore.create({
      data: {
        userId,
        gameType,
        difficulty: difficulty || level?.toString() || "1",
        score
      }
    });
    const pointsEarned = score * 10;
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: pointsEarned } }
    });
    if (gameType === "BIBLE_QUIZ") {
      const levelNum = level || parseInt(difficulty, 10);
      if (!isNaN(levelNum)) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.bibleQuizLevel <= levelNum) {
          await prisma.user.update({
            where: { id: userId },
            data: { bibleQuizLevel: levelNum + 1 }
          });
        }
        let badgeName = null;
        if (levelNum === 10) badgeName = "Bronze";
        else if (levelNum === 20) badgeName = "Silver";
        else if (levelNum === 30) badgeName = "Diamond";
        if (badgeName) {
          let badge = await prisma.badge.findUnique({ where: { name: badgeName } });
          if (!badge) {
            badge = await prisma.badge.create({
              data: {
                name: badgeName,
                description: `Unlocked at level ${levelNum} of Bible Quiz`,
                imageUrl: `assets/images/${badgeName.toLowerCase()}.png`,
                criteriaType: "BIBLE_QUIZ_LEVEL",
                criteriaValue: levelNum
              }
            });
          }
          const existingEarned = await prisma.earnedBadge.findFirst({
            where: { userId, badgeId: badge.id }
          });
          if (!existingEarned) {
            await prisma.earnedBadge.create({
              data: { userId, badgeId: badge.id }
            });
          }
        }
      }
    }

    const coinRes = await grantCoins(prisma, userId, pointsEarned, `Completed a game of ${gameType}`);

    return c.json({ message: "Score saved successfully", score: savedScore, pointsEarned, coinBalance: coinRes.newBalance });
  } catch (error) {
    return c.json({ error: "Failed to save score" }, 500);
  }
});
games.get("/score/:userId", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.req.param("userId");
  const gameType = c.req.query("gameType");
  try {
    const query: any = { userId };
    if (gameType) query.gameType = gameType;
    const scores = await prisma.gameScore.findMany({
      where: query,
      orderBy: { createdAt: "desc" }
    });
    let topScore = 0;
    let lastScore = 0;
    if (scores.length > 0) {
      lastScore = scores[0].score;
      topScore = Math.max(...scores.map((s: any) => s.score));
    }
    return c.json({ scores, topScore, lastScore });
  } catch (error) {
    return c.json({ error: "Failed to fetch scores" }, 500);
  }
});
games.get("/overview", authMiddleware, async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        dailyBreadAttempts: { where: { solved: true } }
      }
    });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    const quizLevel = user.bibleQuizLevel || 1;
    const puzzleSolves = user.dailyBreadAttempts?.length || 0;
    const streak = user.streakCount || 0;
    const maxLevelRow = await prisma.bibleQuizQuestion.aggregate({
      _max: { level: true }
    });
    const maxQuizLevel = maxLevelRow._max.level || 50;
    const quizProgress = Math.min(quizLevel / maxQuizLevel, 1);
    const milestones = [7, 14, 30, 90, 180, 365];
    const nextStreakMilestone = milestones.find((m) => streak < m) || streak + 30;
    const streakProgress = streak > 0 ? Math.min(streak / nextStreakMilestone, 1) : 0;
    return c.json({
      quiz: {
        level: quizLevel,
        points: user.quizPoints || 0,
        progress: quizProgress
      },
      puzzle: {
        solves: puzzleSolves,
        streak,
        nextMilestone: nextStreakMilestone,
        progress: streakProgress
      },
      devotion: {
        points: user.devotionPoints || 0
      },
      dailyBread: {
        points: user.dailyBreadPoints || 0
      },
      audioReel: {
        points: user.audioReelPoints || 0
      },
      videoReel: {
        points: user.videoReelPoints || 0
      },
      totalPoints: user.points || 0
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch games overview" }, 500);
  }
});

games.post("/daily-bread/share", authMiddleware, async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: 10 },
        dailyBreadPoints: { increment: 10 }
      }
    });
    const coinRes = await grantCoins(prisma, userId, 10, "Shared Daily Bread");
    return c.json({ message: "Points awarded for sharing Daily Bread", coinBalance: coinRes.newBalance });
  } catch (error) {
    return c.json({ error: "Failed to award points" }, 500);
  }
});

export default games;
