import { Hono } from "hono";
import { getDrizzle } from "../utils/drizzle";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  gameSettings,
  wordMatchQuestion,
  wordCrossQuestion,
  bibleQuizQuestion,
  gameScore,
  user,
  badge,
  earnedBadge,
  dailyBreadAttempt,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { grantCoinsDrizzle as grantCoins } from "../utils/economy";
import { adminAuthMiddleware } from "../middleware/adminAuth";

import { Bindings, Variables } from "../types";
var games = new Hono<{ Bindings: Bindings; Variables: Variables }>();
games.use("*", authMiddleware);

games.get("/play/word-match", async (c) => {
  const db = getDrizzle(c.env.DB);
  const difficulty = c.req.query("difficulty") || "easy";
  try {
    const settings = await db.query.gameSettings.findFirst({
      where: eq(gameSettings.gameType, "WORD_MATCH"),
    });
    const limit = settings?.totalQuestions || 10;

    const allQuestions = await db.query.wordMatchQuestion.findMany({
      where: eq(wordMatchQuestion.difficulty, difficulty),
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    return c.json({
      questions: selected,
      durationSecs: settings?.durationSecs || 60,
      totalQuestions: limit,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch word match questions" }, 500);
  }
});

games.get("/play/word-cross", async (c) => {
  const db = getDrizzle(c.env.DB);
  const difficulty = c.req.query("difficulty") || "easy";
  try {
    const settings = await db.query.gameSettings.findFirst({
      where: eq(gameSettings.gameType, "WORD_CROSS"),
    });
    const limit = settings?.totalQuestions || 10;

    const allQuestions = await db.query.wordCrossQuestion.findMany({
      where: eq(wordCrossQuestion.difficulty, difficulty),
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    return c.json({
      questions: selected,
      durationSecs: settings?.durationSecs || 60,
      totalQuestions: limit,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch word cross questions" }, 500);
  }
});

games.get("/play/bible-quiz/max-level", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const maxLevelRow = await db.query.bibleQuizQuestion.findFirst({
      orderBy: [desc(bibleQuizQuestion.level)],
    });
    return c.json({ maxLevel: maxLevelRow?.level || 1 });
  } catch (error) {
    return c.json({ error: "Failed to fetch max level" }, 500);
  }
});

games.get("/play/bible-quiz", async (c) => {
  const db = getDrizzle(c.env.DB);
  const levelStr = c.req.query("level") || "1";
  const level = parseInt(levelStr, 10) || 1;
  try {
    const settings = await db.query.gameSettings.findFirst({
      where: eq(gameSettings.gameType, "BIBLE_QUIZ"),
    });
    const limit = settings?.totalQuestions || 10;

    const allQuestions = await db.query.bibleQuizQuestion.findMany({
      where: eq(bibleQuizQuestion.level, level),
    });
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    const maxLevelRow = await db.query.bibleQuizQuestion.findFirst({
      orderBy: [desc(bibleQuizQuestion.level)],
    });
    const maxLevel = maxLevelRow?.level || 1;

    return c.json({
      questions: selected,
      durationSecs: settings?.durationSecs || 60,
      totalQuestions: limit,
      maxLevel,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch bible quiz questions" }, 500);
  }
});

games.post("/score", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = (await c.req.json()) as any;
    const { userId, gameType, difficulty, level, score } = body;
    if (
      !userId ||
      !gameType ||
      (difficulty === void 0 && level === void 0) ||
      score === void 0
    ) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (userId !== c.get("userId")) {
      return c.json(
        { error: "Unauthorized: Cannot submit score for another user" },
        403,
      );
    }

    const settings = await db.query.gameSettings.findFirst({
      where: eq(gameSettings.gameType, gameType),
    });
    const maxScore = settings?.totalQuestions || 10;
    if (typeof score !== "number" || score < 0 || score > maxScore) {
      return c.json(
        { error: `Invalid score. Score must be between 0 and ${maxScore}` },
        400,
      );
    }

    const [savedScore] = await db
      .insert(gameScore)
      .values({
        id: crypto.randomUUID(),
        userId,
        gameType,
        difficulty: difficulty || level?.toString() || "1",
        score,
      })
      .returning();

    const pointsEarned = score * 10;
    await db
      .update(user)
      .set({
        points: sql`${user.points} + ${pointsEarned}`,
      })
      .where(eq(user.id, userId));

    if (gameType === "BIBLE_QUIZ") {
      const levelNum = level || parseInt(difficulty, 10);
      if (!isNaN(levelNum)) {
        const userObj = await db.query.user.findFirst({
          where: eq(user.id, userId),
        });
        if (userObj && (userObj.bibleQuizLevel || 0) <= levelNum) {
          await db
            .update(user)
            .set({
              bibleQuizLevel: levelNum + 1,
            })
            .where(eq(user.id, userId));
        }

        let badgeName = null;
        if (levelNum === 10) badgeName = "Bronze";
        else if (levelNum === 20) badgeName = "Silver";
        else if (levelNum === 30) badgeName = "Diamond";

        if (badgeName) {
          let badgeObj = await db.query.badge.findFirst({
            where: eq(badge.name, badgeName),
          });
          if (!badgeObj) {
            const [newBadge] = await db
              .insert(badge)
              .values({
                id: crypto.randomUUID(),
                name: badgeName,
                description: `Unlocked at level ${levelNum} of Bible Quiz`,
                imageUrl: `assets/images/${badgeName.toLowerCase()}.png`,
                criteriaType: "BIBLE_QUIZ_LEVEL",
                criteriaValue: levelNum,
              })
              .returning();
            badgeObj = newBadge;
          }

          const existingEarned = await db.query.earnedBadge.findFirst({
            where: and(
              eq(earnedBadge.userId, userId),
              eq(earnedBadge.badgeId, badgeObj.id),
            ),
          });
          if (!existingEarned) {
            await db.insert(earnedBadge).values({
              id: crypto.randomUUID(),
              userId,
              badgeId: badgeObj.id,
            });
          }
        }
      }
    }

    const coinRes = await grantCoins(
      db,
      userId,
      pointsEarned,
      `Completed a game of ${gameType}`,
    );

    return c.json({
      message: "Score saved successfully",
      score: savedScore,
      pointsEarned,
      coinBalance: coinRes.newBalance,
    });
  } catch (error) {
    return c.json({ error: "Failed to save score" }, 500);
  }
});

games.get("/score/:userId", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.req.param("userId");
  const gameType = c.req.query("gameType");
  try {
    let whereClause;
    if (gameType) {
      whereClause = and(
        eq(gameScore.userId, userId),
        eq(gameScore.gameType, gameType),
      );
    } else {
      whereClause = eq(gameScore.userId, userId);
    }

    const scores = await db.query.gameScore.findMany({
      where: whereClause,
      orderBy: [desc(gameScore.createdAt)],
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
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  try {
    const userObj = await db.query.user.findFirst({
      where: eq(user.id, userId),
      with: {
        dailyBreadAttempts: {
          where: (attempts: any, { eq }: any) => eq(attempts.solved, true),
        },
      },
    });

    if (!userObj) {
      return c.json({ error: "User not found" }, 404);
    }
    const quizLevel = userObj.bibleQuizLevel || 1;
    const puzzleSolves = userObj.dailyBreadAttempts?.length || 0;
    const streak = userObj.streakCount || 0;

    const maxLevelRow = await db.query.bibleQuizQuestion.findFirst({
      orderBy: [desc(bibleQuizQuestion.level)],
    });
    const maxQuizLevel = maxLevelRow?.level || 50;
    const quizProgress = Math.min(quizLevel / maxQuizLevel, 1);

    const milestones = [7, 14, 30, 90, 180, 365];
    const nextStreakMilestone =
      milestones.find((m) => streak < m) || streak + 30;
    const streakProgress =
      streak > 0 ? Math.min(streak / nextStreakMilestone, 1) : 0;

    return c.json({
      quiz: {
        level: quizLevel,
        points: userObj.quizPoints || 0,
        progress: quizProgress,
      },
      puzzle: {
        solves: puzzleSolves,
        streak,
        nextMilestone: nextStreakMilestone,
        progress: streakProgress,
      },
      devotion: {
        points: userObj.devotionPoints || 0,
      },
      dailyBread: {
        points: userObj.dailyBreadPoints || 0,
      },
      audioReel: {
        points: userObj.audioReelPoints || 0,
      },
      videoReel: {
        points: userObj.videoReelPoints || 0,
      },
      totalPoints: userObj.points || 0,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch games overview" }, 500);
  }
});

games.post("/daily-bread/share", authMiddleware, async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  try {
    await db
      .update(user)
      .set({
        points: sql`${user.points} + 10`,
        dailyBreadPoints: sql`${user.dailyBreadPoints} + 10`,
      })
      .where(eq(user.id, userId));

    const coinRes = await grantCoins(db, userId, 10, "Shared Daily Bread");
    return c.json({
      message: "Points awarded for sharing Daily Bread",
      coinBalance: coinRes.newBalance,
    });
  } catch (error) {
    return c.json({ error: "Failed to award points" }, 500);
  }
});

export default games;
