import { Hono } from "hono";
import { getDrizzle } from "../utils/drizzle";
import { authMiddleware } from "../middleware/auth";
import { Bindings, Variables } from "../types";
import { subscription } from "../db/schema";
import { eq, and, gt, sql } from "drizzle-orm";

var subscriptions = new Hono<{ Bindings: Bindings; Variables: Variables }>();

subscriptions.post("/verify", authMiddleware, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as any;
  const { platform, productId, receiptData, originalTxId } = body;
  if (!platform || !productId || !receiptData || !originalTxId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const db = getDrizzle(c.env.DB);
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  const expiresAtStr = expiresAt.toISOString();

  try {
    const [sub] = await db
      .insert(subscription)
      .values({
        id: crypto.randomUUID(),
        userId,
        platform,
        status: "active",
        productId,
        originalTxId,
        expiresAt: expiresAtStr,
        isAutoRenewing: true,
      })
      .onConflictDoUpdate({
        target: subscription.originalTxId,
        set: {
          status: "active",
          expiresAt: expiresAtStr,
        },
      })
      .returning();

    return c.json({ message: "Subscription verified", subscription: sub });
  } catch (error) {
    console.error("Subscription verify error:", error);
    return c.json({ error: "Failed to verify subscription" }, 500);
  }
});

subscriptions.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const db = getDrizzle(c.env.DB);
  const now = new Date().toISOString();

  const rows = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        eq(subscription.status, "active"),
        gt(subscription.expiresAt, now),
      ),
    )
    .orderBy(subscription.createdAt)
    .limit(1);

  return c.json({ subscription: rows[0] || null });
});

subscriptions.post("/apple-webhook", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = (await c.req.json()) as any;

    const signedPayload = body.signedPayload;
    if (!signedPayload) return c.json({ error: "Missing signedPayload" }, 400);

    const payloadPart = signedPayload.split(".")[1];
    const decodedPayload = JSON.parse(
      atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")),
    );

    const notificationType = decodedPayload.notificationType;
    const signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;
    if (!signedTransactionInfo) return c.json({ ok: true });

    const txPart = signedTransactionInfo.split(".")[1];
    const decodedTx = JSON.parse(
      atob(txPart.replace(/-/g, "+").replace(/_/g, "/")),
    );

    const originalTxId = decodedTx.originalTransactionId;
    const expiresDateMs = decodedTx.expiresDate;

    let status = "active";
    if (["EXPIRED", "DID_FAIL_TO_RENEW", "REFUND"].includes(notificationType)) {
      status = "expired";
    }

    if (originalTxId) {
      const setData: any = { status };
      if (expiresDateMs) {
        setData.expiresAt = new Date(parseInt(expiresDateMs)).toISOString();
      }
      await db
        .update(subscription)
        .set(setData)
        .where(eq(subscription.originalTxId, originalTxId));
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("Apple webhook error:", e);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

subscriptions.post("/google-webhook", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const body = (await c.req.json()) as any;

    if (!body.message || !body.message.data) {
      return c.json({ error: "Invalid Pub/Sub message" }, 400);
    }

    const dataBuffer = Buffer.from(body.message.data, "base64");
    const dataJson = JSON.parse(dataBuffer.toString("utf-8"));

    const subscriptionNotification = dataJson.subscriptionNotification;
    if (!subscriptionNotification) {
      return c.json({ ok: true });
    }

    const purchaseToken = subscriptionNotification.purchaseToken;
    const notificationType = subscriptionNotification.notificationType;

    let status = "active";
    if ([12, 13, 5, 6].includes(notificationType)) {
      status = "expired";
    }

    if (purchaseToken) {
      await db
        .update(subscription)
        .set({ status })
        .where(eq(subscription.originalTxId, purchaseToken));
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("Google webhook error:", e);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default subscriptions;
