import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { grantCoins } from '../utils/economy';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/devotions.ts
import { Bindings, Variables } from '../types';
var devotions = new Hono<{Bindings: Bindings, Variables: Variables}>();
devotions.use("*", authMiddleware);
devotions.get("/plans", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.devotionPlan.findMany({
    where: { status: "APPROVED" },
    include: {
      days: true
    }
  });
  return c.json(list);
});
devotions.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const prisma = getPrisma(c.env.DB);
  if (!query) return c.json([]);
  const list = await prisma.devotionPlan.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { authorName: { contains: query } },
        { tag: { contains: query } }
      ]
    },
    include: {
      days: true
    }
  });
  return c.json(list);
});
devotions.get("/created", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const myPlans = await prisma.devotionPlan.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: { days: true }
  });
  return c.json(myPlans);
});

devotions.get("/plans/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const plan = await prisma.devotionPlan.findUnique({
    where: { id },
    include: { days: true }
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);
  return c.json(plan);
});

devotions.post("/plans", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  
  // Only Gold Badge users can upload devotions
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.verificationBadge !== "GOLD" && !user.isAdmin)) {
    return c.json({ error: "Only Gold badge members can submit devotion plans." }, 403);
  }

  let data: any = {};
  const contentType = c.req.header("content-type") || "";
  
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      authorName: formData.get("authorName") as string,
      authorHandle: formData.get("authorHandle") as string,
      tag: formData.get("tag") as string,
      durationDays: parseInt(formData.get("durationDays") as string, 10) || 1,
    };
    const file = formData.get("image") as unknown as File;
    if (file && file.size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `devotions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const fileBuffer = await file.arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: file.type }
      });
      const origin = new URL(c.req.url).origin;
      data.image = `${origin}/api/v1/media/download/${fileKey}`;
    }
  } else {
    data = await c.req.json();
  }

  data.authorId = userId;
  data.status = "PENDING_REVIEW";

  const plan = await prisma.devotionPlan.create({ data });
  return c.json({ message: "Devotion plan submitted for review successfully", plan });
});

devotions.post("/plans/:id/subscribe", async (c) => {
  const userId = c.get("userId");
  const planId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com` } });
  }
  const existing = await prisma.userPlanProgress.findFirst({
    where: { userId, planId }
  });
  if (existing) return c.json({ message: "Already subscribed", progress: existing });
  const progress = await prisma.userPlanProgress.create({
    data: {
      userId,
      planId,
      currentDay: 1
    }
  });
  return c.json({ message: "Subscribed successfully", progress });
});
devotions.delete("/plans/:id/unsubscribe", async (c) => {
  const userId = c.get("userId");
  const planId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.userPlanProgress.findFirst({
    where: { userId, planId }
  });
  if (!existing) return c.json({ error: "Not subscribed to this plan" }, 400);
  await prisma.userPlanProgress.delete({ where: { id: existing.id } });
  return c.json({ message: "Unsubscribed successfully" });
});
devotions.get("/my-plans", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const progressList = await prisma.userPlanProgress.findMany({
    where: { userId, completedAt: null }
  });
  const planIds = progressList.map((p: any) => p.planId);
  const plans = await prisma.devotionPlan.findMany({
    where: { id: { in: planIds } },
    include: { days: true }
  });
  const formatted = progressList.map((p: any) => {
    const plan = plans.find((pl: any) => pl.id === p.planId);
    const now = /* @__PURE__ */ new Date();
    const started = new Date(p.startedAt);
    const diffMs = now.getTime() - started.getTime();
    const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
    let calculatedCurrentDay = diffDays + 1;
    const actualDays = (plan?.days && plan.days.length > 0) 
        ? plan.days.length 
        : (plan?.durationDays ?? 1);
    if (plan && calculatedCurrentDay > actualDays) {
      calculatedCurrentDay = actualDays;
    }
    return {
      progressId: p.id,
      currentDay: Math.max(p.currentDay, calculatedCurrentDay),
      // Just in case DB has a higher day due to earlier manual progression
      startedAt: p.startedAt,
      reminderTime: p.reminderTime,
      reminderEnabled: p.reminderEnabled,
      plan
    };
  }).filter((item: any) => item.plan != null);
  return c.json(formatted);
});
devotions.get("/plans/:planId/days/:dayNum", async (c) => {
  const userId = c.get("userId");
  const { planId, dayNum } = c.req.param();
  const prisma = getPrisma(c.env.DB);
  const day2 = await prisma.devotionDay.findFirst({
    where: { planId, dayNumber: Number(dayNum) }
  });
  const plan = await prisma.devotionPlan.findUnique({
    where: { id: planId },
    include: { days: true }
  });
  if (!day2 || !plan) return c.json({ error: "Day content or plan not found" }, 404);
  const existingLike = await prisma.devotionDayLike.findUnique({
    where: { userId_dayId: { userId, dayId: day2.id } }
  });
  return c.json({ day: { ...day2, hasLiked: !!existingLike }, plan });
});
devotions.post("/plans/:planId/days/:dayNum/complete", async (c) => {
  const userId = c.get("userId");
  const { planId, dayNum } = c.req.param();
  const dayNumber = Number(dayNum);
  const prisma = getPrisma(c.env.DB);
  const day2 = await prisma.devotionDay.findFirst({
    where: { planId, dayNumber }
  });
  if (!day2) return c.json({ error: "Day content not found" }, 404);
  const progress = await prisma.userPlanProgress.findFirst({
    where: { userId, planId }
  });
  if (!progress) {
    return c.json({ error: "Not subscribed to this plan" }, 400);
  }
  const plan = await prisma.devotionPlan.findUnique({ where: { id: planId } });
  const totalDays = plan ? plan.durationDays : 0;
  let completedAt = null;
  let nextDay = progress.currentDay;
  if (dayNumber >= progress.currentDay) {
    nextDay = dayNumber + 1;
    if (dayNumber >= totalDays) {
      completedAt = /* @__PURE__ */ new Date();
    }
  }
  await prisma.userPlanProgress.update({
    where: { id: progress.id },
    data: {
      currentDay: nextDay,
      completedAt
    }
  });
  
  let coinRes;
  if (dayNumber >= progress.currentDay) {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        points: { increment: day2.pointsEarned },
        devotionPoints: { increment: day2.pointsEarned }
      }
    });
    coinRes = await grantCoins(prisma, userId, day2.pointsEarned, "Completed a devotion day");
  }
  return c.json({
    message: "Day completed successfully",
    pointsEarned: day2.pointsEarned,
    planFinished: completedAt !== null,
    nextDay,
    coinBalance: coinRes?.newBalance
  });
});
devotions.put("/plans/:planId/reminder", async (c) => {
  const userId = c.get("userId");
  const planId = c.req.param("planId");
  const body = await c.req.json();
  const { reminderTime, reminderEnabled } = body;
  const prisma = getPrisma(c.env.DB);
  const progress = await prisma.userPlanProgress.findFirst({
    where: { userId, planId }
  });
  if (!progress) return c.json({ error: "Not subscribed to plan" }, 400);
  const updated = await prisma.userPlanProgress.update({
    where: { id: progress.id },
    data: {
      reminderTime: reminderTime || void 0,
      reminderEnabled: reminderEnabled !== void 0 ? reminderEnabled : void 0
    }
  });
  return c.json(updated);
});
devotions.post("/plans/:id/like", async (c) => {
  const userId = c.get("userId");
  const dayId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const day2 = await prisma.devotionDay.findUnique({ where: { id: dayId } });
  if (!day2) return c.json({ error: "Devotion day not found" }, 404);
  const existing = await prisma.devotionDayLike.findUnique({
    where: { userId_dayId: { userId, dayId } }
  });
  if (existing) {
    return c.json({ message: "Already liked", likes: day2.likesCount, hasLiked: true });
  }
  await prisma.devotionDayLike.create({
    data: { userId, dayId }
  });
  const updated = await prisma.devotionDay.update({
    where: { id: dayId },
    data: { likesCount: { increment: 1 } }
  });
  return c.json({ message: "Day liked", likes: updated.likesCount, hasLiked: true });
});
devotions.post("/plans/:id/share", async (c) => {
  const prisma = getPrisma(c.env.DB);
  return c.json({ message: "Devotion plan shared successfully" });
});

devotions.delete("/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const planId = c.req.param("id");

  const plan = await prisma.devotionPlan.findUnique({ where: { id: planId } });
  if (!plan) return c.json({ error: "Plan not found" }, 404);
  if (plan.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await prisma.devotionPlan.delete({ where: { id: planId } });
  return c.json({ message: "Plan deleted successfully" });
});

devotions.put("/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const planId = c.req.param("id");

  const existingPlan = await prisma.devotionPlan.findUnique({ 
    where: { id: planId },
    include: { days: true }
  });
  if (!existingPlan) return c.json({ error: "Plan not found" }, 404);
  if (existingPlan.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  const reqData = await c.req.json();

  const data = {
    title: reqData.title !== undefined ? reqData.title : existingPlan.title,
    description: reqData.description !== undefined ? reqData.description : existingPlan.description,
    durationDays: reqData.durationDays !== undefined ? reqData.durationDays : existingPlan.durationDays,
    authorName: reqData.authorName !== undefined ? reqData.authorName : existingPlan.authorName,
    authorHandle: reqData.authorHandle !== undefined ? reqData.authorHandle : existingPlan.authorHandle,
    tag: reqData.tag !== undefined ? reqData.tag : existingPlan.tag,
    image: reqData.image !== undefined ? reqData.image : existingPlan.image,
  };

  if (existingPlan.status === "APPROVED") {
    // Create a new PENDING_REVIEW revision
    // If days are not explicitly provided in the request, we copy the existing ones
    const daysToCreate = reqData.days || existingPlan.days;
    const revision = await prisma.devotionPlan.create({
      data: {
        ...data,
        authorId: userId,
        status: "PENDING_REVIEW",
        originalId: existingPlan.id,
        days: {
          create: daysToCreate.map((d: any) => ({
            dayNumber: d.dayNumber,
            title: d.title,
            bodyText: d.bodyText,
            image: d.image,
            videoUrl: d.videoUrl,
            pointsEarned: d.pointsEarned ?? 10
          }))
        }
      },
      include: { days: true }
    });
    return c.json({ message: "Plan revision submitted for review", plan: revision });
  } else {
    // Update in place
    let updatedPlan;
    if (reqData.days) {
      await prisma.devotionDay.deleteMany({ where: { planId } });
      updatedPlan = await prisma.devotionPlan.update({
        where: { id: planId },
        data: {
          ...data,
          status: "PENDING_REVIEW",
          days: {
            create: reqData.days.map((d: any) => ({
              dayNumber: d.dayNumber,
              title: d.title,
              bodyText: d.bodyText,
              image: d.image,
              videoUrl: d.videoUrl,
              pointsEarned: d.pointsEarned ?? 10
            }))
          }
        },
        include: { days: true }
      });
    } else {
      updatedPlan = await prisma.devotionPlan.update({
        where: { id: planId },
        data: {
          ...data,
          status: "PENDING_REVIEW",
        },
        include: { days: true }
      });
    }
    return c.json({ message: "Plan updated successfully", plan: updatedPlan });
  }
});

export default devotions;
