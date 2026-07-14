import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/subscriptions.ts
import { Bindings, Variables } from '../types';
var subscriptions = new Hono<{Bindings: Bindings, Variables: Variables}>();
subscriptions.post("/verify", authMiddleware, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const { platform, productId, receiptData, originalTxId } = body;
  if (!platform || !productId || !receiptData || !originalTxId) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  const prisma = getPrisma(c.env.DB);
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  try {
    const subscription = await prisma.subscription.upsert({
      where: { originalTxId },
      update: {
        status: "active",
        expiresAt,
        updatedAt: /* @__PURE__ */ new Date()
      },
      create: {
        userId,
        platform,
        status: "active",
        productId,
        originalTxId,
        expiresAt,
        isAutoRenewing: true
      }
    });
    return c.json({ message: "Subscription verified", subscription });
  } catch (error) {
    console.error("Subscription verify error:", error);
    return c.json({ error: "Failed to verify subscription" }, 500);
  }
});
subscriptions.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const prisma = getPrisma(c.env.DB);
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "active",
      expiresAt: {
        gt: /* @__PURE__ */ new Date()
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ subscription: activeSubscription || null });
});


export default subscriptions;
