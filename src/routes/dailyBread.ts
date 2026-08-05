import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { grantCoins } from '../utils/economy';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/dailyBread.ts
import { Bindings, Variables } from '../types';
var dailyBread = new Hono<{Bindings: Bindings, Variables: Variables}>();
dailyBread.use("*", authMiddleware);
dailyBread.get("/today", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let puzzle = await prisma.dailyBread.findUnique({
    where: { date: todayStr }
  });
  if (!puzzle) {
    puzzle = await prisma.dailyBread.create({
      data: {
        date: todayStr,
        puzzleData: JSON.stringify({
          letters: ["M", "O", "S", "E", "S", "A", "B", "C"],
          hints: ["Leader of Exodus"]
        }),
        solution: "MOSES"
      }
    });
  }
  return c.json({
    id: puzzle.id,
    date: puzzle.date,
    puzzleData: JSON.parse(puzzle.puzzleData)
  });
});
dailyBread.post("/submit", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { puzzleId, solution } = body;
  const prisma = getPrisma(c.env.DB);
  const puzzle = await prisma.dailyBread.findUnique({
    where: { id: puzzleId }
  });
  if (!puzzle) {
    return c.json({ error: "Puzzle not found" }, 404);
  }
  const isCorrect = puzzle.solution.toLowerCase() === (solution || "").trim().toLowerCase();
  if (isCorrect) {
    await prisma.dailyBreadAttempt.create({
      data: {
        userId,
        dailyBreadId: puzzleId,
        solved: true
      }
    });
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: 20 },
        dailyBreadPoints: { increment: 20 },
        streakCount: { increment: 1 }
      }
    });
    
    const coinRes = await grantCoins(prisma, userId, 20, "Solved Daily Bread");

    return c.json({
      correct: true,
      pointsEarned: 20,
      coinBalance: coinRes.newBalance,
      message: "Awesome job! Puzzle solved."
    });
  }
  return c.json({
    correct: false,
    message: "Incorrect answer. Try again!"
  });
});
dailyBread.get("/history", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const history = await prisma.dailyBreadAttempt.findMany({
    where: { userId, solved: true },
    include: { dailyBread: true },
    orderBy: { createdAt: "desc" }
  });
  return c.json(history);
});
dailyBread.get("/streak", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakCount: true }
  });
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({
    streak: user.streakCount
  });
});
dailyBread.get("/verse-today", async (c) => {
  const verses = [
    {
      reference: "John 3:16",
      text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
      explanation: "A reflection on God\u2019s boundless love and the gift of eternal life."
    },
    {
      reference: "Philippians 4:13",
      text: "I can do all things through him who strengthens me.",
      explanation: "A reminder of the strength and empowerment we receive from Christ."
    },
    {
      reference: "Proverbs 3:5-6",
      text: "Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.",
      explanation: "Encouragement to trust God fully in every aspect of life."
    },
    {
      reference: "Jeremiah 29:11",
      text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
      explanation: "God has a purposeful and hopeful plan for our lives."
    },
    {
      reference: "Romans 8:28",
      text: "And we know that for those who love God all things work together for good, for those who are called according to his purpose.",
      explanation: "Assurance that God works all things out for our ultimate good."
    },
    {
      reference: "Isaiah 41:10",
      text: "Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.",
      explanation: "A comforting promise of God\u2019s presence and support in times of fear."
    },
    {
      reference: "Psalm 23:1",
      text: "The Lord is my shepherd; I shall not want.",
      explanation: "A beautiful declaration of God\u2019s provision and care as our Shepherd."
    }
  ];
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = todayStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % verses.length;
  const verseData = verses[index];
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  let stat = await prisma.dailyVerseStat.findUnique({
    where: { date: todayStr }
  });
  if (!stat) {
    stat = await prisma.dailyVerseStat.create({
      data: { date: todayStr }
    });
  }
  const userLike = await prisma.dailyVerseLike.findUnique({
    where: {
      userId_date: {
        userId,
        date: todayStr
      }
    }
  });
  return c.json({
    ...verseData,
    likesCount: stat.likes,
    sharesCount: stat.shares,
    commentsCount: stat.comments,
    hasLiked: !!userLike
  });
});
dailyBread.post("/verse-today/like", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const existingLike = await prisma.dailyVerseLike.findUnique({
    where: {
      userId_date: {
        userId,
        date: todayStr
      }
    }
  });
  if (existingLike) {
    await prisma.dailyVerseLike.delete({
      where: { id: existingLike.id }
    });
    await prisma.dailyVerseStat.update({
      where: { date: todayStr },
      data: { likes: { decrement: 1 } }
    });
    return c.json({ liked: false });
  } else {
    await prisma.dailyVerseLike.create({
      data: { userId, date: todayStr }
    });
    await prisma.dailyVerseStat.upsert({
      where: { date: todayStr },
      create: { date: todayStr, likes: 1 },
      update: { likes: { increment: 1 } }
    });
    return c.json({ liked: true });
  }
});
dailyBread.post("/verse-today/share", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const stat = await prisma.dailyVerseStat.upsert({
    where: { date: todayStr },
    create: { date: todayStr, shares: 1 },
    update: { shares: { increment: 1 } }
  });
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: 10 },
      dailyBreadPoints: { increment: 10 }
    }
  });
  const coinRes = await grantCoins(prisma, userId, 10, "Shared Daily Verse");
  
  return c.json({ sharesCount: stat.shares, coinBalance: coinRes.newBalance });
});


export default dailyBread;
