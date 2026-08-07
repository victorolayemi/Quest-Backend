
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and, sql, inArray, desc, like } from 'drizzle-orm';
import { devotionPlan, devotionDay, userPlanProgress, user, devotionDayLike } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { grantCoinsDrizzle as grantCoins } from '../utils/economy';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { Bindings, Variables } from '../types';

var devotions = new Hono<{Bindings: Bindings, Variables: Variables}>();
devotions.use("*", authMiddleware);

devotions.get("/plans", async (c) => {
  const db = getDrizzle(c.env.DB);
  const list = await db.query.devotionPlan.findMany({
    where: eq(devotionPlan.status, "APPROVED"),
    with: { devotionDays: true }
  });
  return c.json(list);
});

devotions.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const db = getDrizzle(c.env.DB);
  if (!query) return c.json([]);
  
  const searchPattern = `%${query}%`;
  
  const list = await db.query.devotionPlan.findMany({
    where: and(
      eq(devotionPlan.status, "APPROVED"),
      or(
        like(devotionPlan.title, searchPattern),
        like(devotionPlan.description, searchPattern),
        like(devotionPlan.authorName, searchPattern),
        like(devotionPlan.tag, searchPattern)
      )
    ),
    with: { devotionDays: true }
  });
  return c.json(list);
});

devotions.get("/created", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const myPlans = await db.query.devotionPlan.findMany({
    where: eq(devotionPlan.authorId, userId as string),
    orderBy: [desc(devotionPlan.createdAt)],
    with: { devotionDays: true }
  });
  return c.json(myPlans);
});

devotions.get("/plans/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  const plan = await db.query.devotionPlan.findFirst({
    where: eq(devotionPlan.id, id),
    with: { devotionDays: true }
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);
  return c.json(plan);
});

devotions.post("/plans", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const userRes = await db.query.user.findFirst({ where: eq(user.id, userId as string) });
  if (!userRes || (userRes.verificationBadge !== "GOLD" && !userRes.isAdmin)) {
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
  
  const planId = crypto.randomUUID();
  const [plan] = await db.insert(devotionPlan).values({
    id: planId,
    ...data
  }).returning();
  
  return c.json({ message: "Devotion plan submitted for review successfully", plan });
});

devotions.post("/plans/:id/subscribe", async (c) => {
  const userId = c.get("userId");
  const planId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const existingUser = await db.query.user.findFirst({ where: eq(user.id, userId as string) });
  if (!existingUser) {
    await db.insert(user).values({ id: userId as string, email: `${userId}@example.com` });
  }
  
  const existing = await db.query.userPlanProgress.findFirst({
    where: and(eq(userPlanProgress.userId, userId as string), eq(userPlanProgress.planId, planId))
  });
  
  if (existing) return c.json({ message: "Already subscribed", progress: existing });
  
  const [progress] = await db.insert(userPlanProgress).values({
    id: crypto.randomUUID(),
    userId: userId as string,
    planId,
    currentDay: 1
  }).returning();
  
  return c.json({ message: "Subscribed successfully", progress });
});

devotions.delete("/plans/:id/unsubscribe", async (c) => {
  const userId = c.get("userId");
  const planId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.userPlanProgress.findFirst({
    where: and(eq(userPlanProgress.userId, userId as string), eq(userPlanProgress.planId, planId))
  });
  
  if (!existing) return c.json({ error: "Not subscribed to this plan" }, 400);
  
  await db.delete(userPlanProgress).where(eq(userPlanProgress.id, existing.id));
  
  return c.json({ message: "Unsubscribed successfully" });
});

devotions.get("/my-plans", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const progressList = await db.query.userPlanProgress.findMany({
    where: and(
      eq(userPlanProgress.userId, userId as string),
      sql`${userPlanProgress.completedAt} IS NULL`
    )
  });
  
  if (progressList.length === 0) return c.json([]);
  
  const planIds = progressList.map((p: any) => p.planId);
  
  const plans = await db.query.devotionPlan.findMany({
    where: inArray(devotionPlan.id, planIds),
    with: { devotionDays: true }
  });
  
  const formatted = progressList.map((p: any) => {
    const plan = plans.find((pl: any) => pl.id === p.planId);
    const now = new Date();
    const started = new Date(p.startedAt);
    const diffMs = now.getTime() - started.getTime();
    const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
    let calculatedCurrentDay = diffDays + 1;
    
    const actualDays = (plan?.devotionDays && plan.devotionDays.length > 0) 
        ? plan.devotionDays.length 
        : (plan?.durationDays ?? 1);
        
    if (plan && calculatedCurrentDay > actualDays) {
      calculatedCurrentDay = actualDays;
    }
    
    return {
      progressId: p.id,
      currentDay: Math.max(p.currentDay, calculatedCurrentDay),
      startedAt: p.startedAt,
      reminderTime: p.reminderTime,
      reminderEnabled: !!p.reminderEnabled,
      plan
    };
  }).filter((item: any) => item.plan != null);
  
  return c.json(formatted);
});

devotions.get("/plans/:planId/days/:dayNum", async (c) => {
  const userId = c.get("userId");
  const { planId, dayNum } = c.req.param();
  const db = getDrizzle(c.env.DB);
  
  const day2 = await db.query.devotionDay.findFirst({
    where: and(
      eq(devotionDay.planId, planId),
      eq(devotionDay.dayNumber, Number(dayNum))
    )
  });
  
  const plan = await db.query.devotionPlan.findFirst({
    where: eq(devotionPlan.id, planId),
    with: { devotionDays: true }
  });
  
  if (!day2 || !plan) return c.json({ error: "Day content or plan not found" }, 404);
  
  const existingLike = await db.query.devotionDayLike.findFirst({
    where: and(
      eq(devotionDayLike.userId, userId as string),
      eq(devotionDayLike.dayId, day2.id)
    )
  });
  
  return c.json({ day: { ...day2, hasLiked: !!existingLike }, plan });
});

devotions.post("/plans/:planId/days/:dayNum/complete", async (c) => {
  const userId = c.get("userId");
  const { planId, dayNum } = c.req.param();
  const dayNumber = Number(dayNum);
  const db = getDrizzle(c.env.DB);
  
  const day2 = await db.query.devotionDay.findFirst({
    where: and(
      eq(devotionDay.planId, planId),
      eq(devotionDay.dayNumber, dayNumber)
    )
  });
  
  if (!day2) return c.json({ error: "Day content not found" }, 404);
  
  const progress = await db.query.userPlanProgress.findFirst({
    where: and(
      eq(userPlanProgress.userId, userId as string),
      eq(userPlanProgress.planId, planId)
    )
  });
  
  if (!progress) {
    return c.json({ error: "Not subscribed to this plan" }, 400);
  }
  
  const plan = await db.query.devotionPlan.findFirst({ where: eq(devotionPlan.id, planId) });
  const totalDays = plan ? plan.durationDays : 0;
  
  let completedAt = null;
  let nextDay = progress.currentDay;
  
  if (dayNumber >= progress.currentDay) {
    nextDay = dayNumber + 1;
    if (dayNumber >= totalDays) {
      completedAt = new Date().toISOString();
    }
  }
  
  const [updatedProgress] = await db.update(userPlanProgress).set({
    currentDay: nextDay,
    completedAt: completedAt ? sql`CURRENT_TIMESTAMP` : null
  }).where(eq(userPlanProgress.id, progress.id)).returning();
  
  let coinRes;
  if (dayNumber >= progress.currentDay) {
    await db.update(user).set({
      points: sql`${user.points} + ${day2.pointsEarned}`,
      devotionPoints: sql`${user.devotionPoints} + ${day2.pointsEarned}`
    }).where(eq(user.id, userId as string));
    
    coinRes = await grantCoins(db, userId as string, day2.pointsEarned, "Completed a devotion day");
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
  const body = await c.req.json() as any;
  const { reminderTime, reminderEnabled } = body;
  const db = getDrizzle(c.env.DB);
  
  const progress = await db.query.userPlanProgress.findFirst({
    where: and(eq(userPlanProgress.userId, userId as string), eq(userPlanProgress.planId, planId))
  });
  
  if (!progress) return c.json({ error: "Not subscribed to plan" }, 400);
  
  let setVals: any = {};
  if (reminderTime !== undefined) setVals.reminderTime = reminderTime;
  if (reminderEnabled !== undefined) setVals.reminderEnabled = reminderEnabled ? 1 : 0;
  
  const [updated] = await db.update(userPlanProgress)
    .set(setVals)
    .where(eq(userPlanProgress.id, progress.id))
    .returning();
    
  return c.json({
    ...updated,
    reminderEnabled: !!updated.reminderEnabled
  });
});

devotions.post("/plans/:id/like", async (c) => {
  const userId = c.get("userId");
  const dayId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const day2 = await db.query.devotionDay.findFirst({ where: eq(devotionDay.id, dayId) });
  if (!day2) return c.json({ error: "Devotion day not found" }, 404);
  
  const existing = await db.query.devotionDayLike.findFirst({
    where: and(
      eq(devotionDayLike.userId, userId as string),
      eq(devotionDayLike.dayId, dayId)
    )
  });
  
  if (existing) {
    return c.json({ message: "Already liked", likes: day2.likesCount, hasLiked: true });
  }
  
  await db.insert(devotionDayLike).values({
    id: crypto.randomUUID(),
    userId: userId as string,
    dayId
  });
  
  const [updated] = await db.update(devotionDay).set({
    likesCount: sql`${devotionDay.likesCount} + 1`
  }).where(eq(devotionDay.id, dayId)).returning();
  
  return c.json({ message: "Day liked", likes: updated.likesCount, hasLiked: true });
});

devotions.post("/plans/:id/share", async (c) => {
  return c.json({ message: "Devotion plan shared successfully" });
});

devotions.delete("/plans/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const planId = c.req.param("id");

  const plan = await db.query.devotionPlan.findFirst({ where: eq(devotionPlan.id, planId) });
  if (!plan) return c.json({ error: "Plan not found" }, 404);
  if (plan.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(devotionPlan).where(eq(devotionPlan.id, planId));
  return c.json({ message: "Plan deleted successfully" });
});

devotions.put("/plans/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const planId = c.req.param("id");

  const existingPlan = await db.query.devotionPlan.findFirst({ 
    where: eq(devotionPlan.id, planId),
    with: { devotionDays: true }
  });
  if (!existingPlan) return c.json({ error: "Plan not found" }, 404);
  if (existingPlan.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  const reqData = await c.req.json() as any;

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
    const daysToCreate = reqData.days || existingPlan.devotionDays || [];
    
    const newPlanId = crypto.randomUUID();
    const [revision] = await db.insert(devotionPlan).values({
      id: newPlanId,
      ...data,
      authorId: userId as string,
      status: "PENDING_REVIEW",
      originalId: existingPlan.id,
    }).returning();
    
    if (daysToCreate.length > 0) {
      const mappedDays = daysToCreate.map((d: any) => ({
        id: crypto.randomUUID(),
        planId: newPlanId,
        dayNumber: d.dayNumber,
        title: d.title,
        bodyText: d.bodyText,
        image: d.image,
        videoUrl: d.videoUrl,
        pointsEarned: d.pointsEarned ?? 10
      }));
      await db.insert(devotionDay).values(mappedDays);
    }
    
    const finalRevision = await db.query.devotionPlan.findFirst({
      where: eq(devotionPlan.id, newPlanId),
      with: { devotionDays: true }
    });
    
    return c.json({ message: "Plan revision submitted for review", plan: finalRevision });
  } else {
    if (reqData.days) {
      await db.delete(devotionDay).where(eq(devotionDay.planId, planId));
      
      const [updated] = await db.update(devotionPlan).set({
        ...data,
        status: "PENDING_REVIEW"
      }).where(eq(devotionPlan.id, planId)).returning();
      
      if (reqData.days.length > 0) {
        const mappedDays = reqData.days.map((d: any) => ({
          id: crypto.randomUUID(),
          planId: planId,
          dayNumber: d.dayNumber,
          title: d.title,
          bodyText: d.bodyText,
          image: d.image,
          videoUrl: d.videoUrl,
          pointsEarned: d.pointsEarned ?? 10
        }));
        await db.insert(devotionDay).values(mappedDays);
      }
      
      const finalPlan = await db.query.devotionPlan.findFirst({
        where: eq(devotionPlan.id, planId),
        with: { devotionDays: true }
      });
      return c.json({ message: "Plan updated successfully", plan: finalPlan });
    } else {
      await db.update(devotionPlan).set({
        ...data,
        status: "PENDING_REVIEW"
      }).where(eq(devotionPlan.id, planId));
      
      const finalPlan = await db.query.devotionPlan.findFirst({
        where: eq(devotionPlan.id, planId),
        with: { devotionDays: true }
      });
      
      return c.json({ message: "Plan updated successfully", plan: finalPlan });
    }
  }
});

export default devotions;
