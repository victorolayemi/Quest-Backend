
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, sql, gte, and } from 'drizzle-orm';
import { 
  badge, 
  earnedBadge, 
  user 
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

import { Bindings, Variables } from '../types';
var badges = new Hono<{Bindings: Bindings, Variables: Variables}>();
badges.use("*", authMiddleware);

async function seedBadgesIfEmpty(db: any) {
  const allBadges = await db.query.badge.findMany();
  const count = allBadges.length;
  if (count === 0) {
    await db.insert(badge).values([
      {
        id: crypto.randomUUID(),
        name: "First Word",
        description: "Solve your first Daily Bread puzzle",
        imageUrl: "/assets/badges/first_word.png",
        criteriaType: "DAILY_BREAD_SOLVE",
        criteriaValue: 1
      },
      {
        id: crypto.randomUUID(),
        name: "Quiz Master",
        description: "Win 5 Trivia Quizzes",
        imageUrl: "/assets/badges/quiz_master.png",
        criteriaType: "QUIZ_WIN",
        criteriaValue: 5
      },
      {
        id: crypto.randomUUID(),
        name: "Streak Builder",
        description: "Achieve a 7-day study streak",
        imageUrl: "/assets/badges/streak_builder.png",
        criteriaType: "STREAK_DAYS",
        criteriaValue: 7
      }
    ]);
  }
}

badges.get("/", async (c) => {
  const db = getDrizzle(c.env.DB);
  await seedBadgesIfEmpty(db);
  const list = await db.query.badge.findMany();
  return c.json(list);
});

badges.get("/earned", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.earnedBadge.findMany({
    where: eq(earnedBadge.userId, userId),
    with: { badge: true }
  });
  
  return c.json(list.map((eb: any) => eb.badge));
});

badges.get("/progress", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  await seedBadgesIfEmpty(db);
  
  const userObj = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: {
      dailyBreadAttempts: {
        where: (attempts: any, { eq }: any) => eq(attempts.solved, true)
      },
      quizAttempts: true
    }
  });
  
  if (!userObj) return c.json({ error: "User not found" }, 404);
  
  const allBadges = await db.query.badge.findMany();
  const earned = await db.query.earnedBadge.findMany({ where: eq(earnedBadge.userId, userId) });
  const earnedBadgeIds = earned.map((e: any) => e.badgeId);
  
  const progress = await Promise.all(allBadges.map(async (badgeObj: any) => {
    let currentVal = 0;
    if (badgeObj.criteriaType === "DAILY_BREAD_SOLVE") {
      currentVal = userObj.dailyBreadAttempts?.length || 0;
    } else if (badgeObj.criteriaType === "QUIZ_WIN") {
      currentVal = userObj.quizAttempts?.length || 0;
    } else if (badgeObj.criteriaType === "STREAK_DAYS") {
      currentVal = userObj.streakCount || 0;
    }
    
    const percentage = Math.min(Math.floor(currentVal / badgeObj.criteriaValue * 100), 100);
    let isEarned = earnedBadgeIds.includes(badgeObj.id);
    
    if (!isEarned && percentage >= 100) {
      await db.insert(earnedBadge).values({
        id: crypto.randomUUID(),
        userId,
        badgeId: badgeObj.id,
        earnedAt: sql`CURRENT_TIMESTAMP`
      });
      await db.update(user).set({
        points: sql`${user.points} + 50`
      }).where(eq(user.id, userId));
      isEarned = true;
    }
    return {
      badge: badgeObj,
      currentValue: currentVal,
      targetValue: badgeObj.criteriaValue,
      percentage,
      isEarned
    };
  }));
  return c.json(progress);
});

badges.get("/new", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const newlyEarned = await db.query.earnedBadge.findMany({
    where: and(
      eq(earnedBadge.userId, userId),
      gte(earnedBadge.earnedAt, fiveMinsAgo)
    ),
    with: { badge: true }
  });
  
  return c.json(newlyEarned.map((e: any) => e.badge));
});

badges.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const badgeObj = await db.query.badge.findFirst({ where: eq(badge.id, id) });
  if (!badgeObj) return c.json({ error: "Badge not found" }, 404);
  return c.json(badgeObj);
});

badges.post("/:id/claim", async (c) => {
  const userId = c.get("userId") as string;
  const badgeId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const earned = await db.query.earnedBadge.findFirst({
    where: and(eq(earnedBadge.userId, userId), eq(earnedBadge.badgeId, badgeId))
  });
  
  if (!earned) {
    const badgeObj = await db.query.badge.findFirst({ where: eq(badge.id, badgeId) });
    if (!badgeObj) return c.json({ error: "Badge not found" }, 404);
    
    await db.insert(earnedBadge).values({
      id: crypto.randomUUID(),
      userId,
      badgeId,
      earnedAt: sql`CURRENT_TIMESTAMP`
    });
  }
  
  await db.update(user).set({
    points: sql`${user.points} + 50`
  }).where(eq(user.id, userId));
  
  return c.json({
    message: "Badge reward claimed! +50 Points."
  });
});

export default badges;
