
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and, sql, desc } from 'drizzle-orm';
import { dailyBread, dailyBreadAttempt, user, dailyVerseStat, dailyVerseLike } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { grantCoinsDrizzle as grantCoins } from '../utils/economy';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { Bindings, Variables } from '../types';

var dailyBreadRoute = new Hono<{Bindings: Bindings, Variables: Variables}>();
dailyBreadRoute.use("*", authMiddleware);

dailyBreadRoute.get("/today", async (c) => {
  const db = getDrizzle(c.env.DB);
  const todayStr = new Date().toISOString().split("T")[0];
  
  let puzzle = await db.query.dailyBread.findFirst({
    where: eq(dailyBread.date, todayStr)
  });
  
  if (!puzzle) {
    const puzzleId = crypto.randomUUID();
    [puzzle] = await db.insert(dailyBread).values({
      id: puzzleId,
      date: todayStr,
      puzzleData: JSON.stringify({
        letters: ["M", "O", "S", "E", "S", "A", "B", "C"],
        hints: ["Leader of Exodus"]
      }),
      solution: "MOSES"
    }).returning();
  }
  
  return c.json({
    id: puzzle.id,
    date: puzzle.date,
    puzzleData: JSON.parse(puzzle.puzzleData)
  });
});

dailyBreadRoute.post("/submit", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { puzzleId, solution } = body;
  const db = getDrizzle(c.env.DB);
  
  const puzzle = await db.query.dailyBread.findFirst({
    where: eq(dailyBread.id, puzzleId)
  });
  
  if (!puzzle) {
    return c.json({ error: "Puzzle not found" }, 404);
  }
  
  const isCorrect = puzzle.solution.toLowerCase() === (solution || "").trim().toLowerCase();
  
  if (isCorrect) {
    await db.insert(dailyBreadAttempt).values({
      id: crypto.randomUUID(),
      userId: userId as string,
      dailyBreadId: puzzleId,
      solved: true
    });
    
    await db.update(user).set({
      points: sql`${user.points} + 20`,
      dailyBreadPoints: sql`${user.dailyBreadPoints} + 20`,
      streakCount: sql`${user.streakCount} + 1`
    }).where(eq(user.id, userId as string));
    
    const coinRes = await grantCoins(db, userId as string, 20, "Solved Daily Bread");

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

dailyBreadRoute.get("/history", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const history = await db.query.dailyBreadAttempt.findMany({
    where: and(eq(dailyBreadAttempt.userId, userId as string), eq(dailyBreadAttempt.solved, true)),
    with: { dailyBread: true },
    orderBy: [desc(dailyBreadAttempt.createdAt)]
  });
  
  return c.json(history);
});

dailyBreadRoute.get("/streak", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, userId as string),
    columns: { streakCount: true }
  });
  
  if (!userRecord) return c.json({ error: "User not found" }, 404);
  
  return c.json({
    streak: userRecord.streakCount
  });
});

dailyBreadRoute.get("/verse-today", async (c) => {
  const verses = [
    {
      reference: "John 3:16",
      text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
      explanation: "A reflection on God’s boundless love and the gift of eternal life."
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
      explanation: "A comforting promise of God’s presence and support in times of fear."
    },
    {
      reference: "Psalm 23:1",
      text: "The Lord is my shepherd; I shall not want.",
      explanation: "A beautiful declaration of God’s provision and care as our Shepherd."
    }
  ];
  
  const todayStr = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = todayStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % verses.length;
  const verseData = verses[index];
  
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  
  let stat = await db.query.dailyVerseStat.findFirst({
    where: eq(dailyVerseStat.date, todayStr)
  });
  
  if (!stat) {
    [stat] = await db.insert(dailyVerseStat).values({
      id: crypto.randomUUID(),
      date: todayStr
    }).returning();
  }
  
  const userLike = await db.query.dailyVerseLike.findFirst({
    where: and(
      eq(dailyVerseLike.userId, userId as string),
      eq(dailyVerseLike.date, todayStr)
    )
  });
  
  return c.json({
    ...verseData,
    likesCount: stat.likes,
    sharesCount: stat.shares,
    commentsCount: stat.comments,
    hasLiked: !!userLike
  });
});

dailyBreadRoute.post("/verse-today/like", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const todayStr = new Date().toISOString().split("T")[0];
  
  const existingLike = await db.query.dailyVerseLike.findFirst({
    where: and(
      eq(dailyVerseLike.userId, userId as string),
      eq(dailyVerseLike.date, todayStr)
    )
  });
  
  if (existingLike) {
    await db.delete(dailyVerseLike).where(eq(dailyVerseLike.id, existingLike.id));
    
    await db.update(dailyVerseStat).set({
      likes: sql`${dailyVerseStat.likes} - 1`
    }).where(eq(dailyVerseStat.date, todayStr));
    
    return c.json({ liked: false });
  } else {
    await db.insert(dailyVerseLike).values({
      id: crypto.randomUUID(),
      userId: userId as string,
      date: todayStr
    });
    
    const existingStat = await db.query.dailyVerseStat.findFirst({
      where: eq(dailyVerseStat.date, todayStr)
    });
    
    if (existingStat) {
      await db.update(dailyVerseStat).set({
        likes: sql`${dailyVerseStat.likes} + 1`
      }).where(eq(dailyVerseStat.date, todayStr));
    } else {
      await db.insert(dailyVerseStat).values({
        id: crypto.randomUUID(),
        date: todayStr,
        likes: 1
      });
    }
    
    return c.json({ liked: true });
  }
});

dailyBreadRoute.post("/verse-today/share", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const todayStr = new Date().toISOString().split("T")[0];
  
  let finalShares = 1;
  const existingStat = await db.query.dailyVerseStat.findFirst({
    where: eq(dailyVerseStat.date, todayStr)
  });
  
  if (existingStat) {
    const [updated] = await db.update(dailyVerseStat).set({
      shares: sql`${dailyVerseStat.shares} + 1`
    }).where(eq(dailyVerseStat.date, todayStr)).returning();
    finalShares = updated.shares;
  } else {
    const [inserted] = await db.insert(dailyVerseStat).values({
      id: crypto.randomUUID(),
      date: todayStr,
      shares: 1
    }).returning();
    finalShares = inserted.shares;
  }
  
  await db.update(user).set({
    points: sql`${user.points} + 10`,
    dailyBreadPoints: sql`${user.dailyBreadPoints} + 10`
  }).where(eq(user.id, userId as string));
  
  const coinRes = await grantCoins(db, userId as string, 10, "Shared Daily Verse");
  
  return c.json({ sharesCount: finalShares, coinBalance: coinRes.newBalance });
});


export default dailyBreadRoute;
