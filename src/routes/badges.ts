import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/badges.ts
import { Bindings, Variables } from '../types';
var badges = new Hono<{Bindings: Bindings, Variables: Variables}>();
badges.use("*", authMiddleware);
async function seedBadgesIfEmpty(prisma: any) {
  const count = await prisma.badge.count();
  if (count === 0) {
    await prisma.badge.createMany({
      data: [
        {
          name: "First Word",
          description: "Solve your first Daily Bread puzzle",
          imageUrl: "/assets/badges/first_word.png",
          criteriaType: "DAILY_BREAD_SOLVE",
          criteriaValue: 1
        },
        {
          name: "Quiz Master",
          description: "Win 5 Trivia Quizzes",
          imageUrl: "/assets/badges/quiz_master.png",
          criteriaType: "QUIZ_WIN",
          criteriaValue: 5
        },
        {
          name: "Streak Builder",
          description: "Achieve a 7-day study streak",
          imageUrl: "/assets/badges/streak_builder.png",
          criteriaType: "STREAK_DAYS",
          criteriaValue: 7
        }
      ]
    });
  }
}
badges.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await seedBadgesIfEmpty(prisma);
  const list = await prisma.badge.findMany();
  return c.json(list);
});
badges.get("/earned", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.earnedBadge.findMany({
    where: { userId },
    include: { badge: true }
  });
  return c.json(list.map((eb: any) => eb.badge));
});
badges.get("/progress", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  await seedBadgesIfEmpty(prisma);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      dailyBreadAttempts: { where: { solved: true } },
      quizAttempts: true
    }
  });
  if (!user) return c.json({ error: "User not found" }, 404);
  const allBadges = await prisma.badge.findMany();
  const earned = await prisma.earnedBadge.findMany({ where: { userId } });
  const earnedBadgeIds = earned.map((e: any) => e.badgeId);
  const progress = await Promise.all(allBadges.map(async (badge: any) => {
    let currentVal = 0;
    if (badge.criteriaType === "DAILY_BREAD_SOLVE") {
      currentVal = user.dailyBreadAttempts.length;
    } else if (badge.criteriaType === "QUIZ_WIN") {
      currentVal = user.quizAttempts.length;
    } else if (badge.criteriaType === "STREAK_DAYS") {
      currentVal = user.streakCount;
    }
    const percentage = Math.min(Math.floor(currentVal / badge.criteriaValue * 100), 100);
    let isEarned = earnedBadgeIds.includes(badge.id);
    if (!isEarned && percentage >= 100) {
      await prisma.earnedBadge.create({
        data: { userId, badgeId: badge.id }
      });
      await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: 50 } }
      });
      isEarned = true;
    }
    return {
      badge,
      currentValue: currentVal,
      targetValue: badge.criteriaValue,
      percentage,
      isEarned
    };
  }));
  return c.json(progress);
});
badges.get("/new", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const newlyEarned = await prisma.earnedBadge.findMany({
    where: {
      userId,
      earnedAt: { gte: new Date(Date.now() - 5 * 60 * 1e3) }
      // Last 5 minutes
    },
    include: { badge: true }
  });
  return c.json(newlyEarned.map((e: any) => e.badge));
});
badges.get("/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const badge = await prisma.badge.findUnique({ where: { id } });
  if (!badge) return c.json({ error: "Badge not found" }, 404);
  return c.json(badge);
});
badges.post("/:id/claim", async (c) => {
  const userId = c.get("userId");
  const badgeId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const earned = await prisma.earnedBadge.findFirst({
    where: { userId, badgeId }
  });
  if (!earned) {
    const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) return c.json({ error: "Badge not found" }, 404);
    await prisma.earnedBadge.create({
      data: { userId, badgeId }
    });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: 50 } }
  });
  return c.json({
    message: "Badge reward claimed! +50 Points."
  });
});


export default badges;
