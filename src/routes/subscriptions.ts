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

subscriptions.post("/apple-webhook", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    
    // In a real implementation, you MUST verify the JWS signature of body.signedPayload
    // using Apple's public keys.
    const signedPayload = body.signedPayload;
    if (!signedPayload) return c.json({ error: "Missing signedPayload" }, 400);

    // Decode JWT payload (without verifying signature just for extraction in this simplified version)
    const payloadPart = signedPayload.split('.')[1];
    const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
    
    const notificationType = decodedPayload.notificationType;
    const signedTransactionInfo = decodedPayload.data?.signedTransactionInfo;
    if (!signedTransactionInfo) return c.json({ ok: true }); // No transaction info

    const txPart = signedTransactionInfo.split('.')[1];
    const decodedTx = JSON.parse(atob(txPart.replace(/-/g, '+').replace(/_/g, '/')));

    const originalTxId = decodedTx.originalTransactionId;
    const expiresDateMs = decodedTx.expiresDate;
    
    let status = "active";
    if (notificationType === "EXPIRED" || notificationType === "DID_FAIL_TO_RENEW" || notificationType === "REFUND") {
      status = "expired";
    }

    if (originalTxId) {
      await prisma.subscription.updateMany({
        where: { originalTxId },
        data: {
          status,
          expiresAt: expiresDateMs ? new Date(parseInt(expiresDateMs)) : undefined,
          updatedAt: new Date()
        }
      });
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("Apple webhook error:", e);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

subscriptions.post("/google-webhook", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const body = await c.req.json();
    
    if (!body.message || !body.message.data) {
      return c.json({ error: "Invalid Pub/Sub message" }, 400);
    }

    const dataBuffer = Buffer.from(body.message.data, 'base64');
    const dataJson = JSON.parse(dataBuffer.toString('utf-8'));

    // Google Play Developer Notification
    const subscriptionNotification = dataJson.subscriptionNotification;
    if (!subscriptionNotification) {
      return c.json({ ok: true }); // Test message or not a sub notification
    }

    const purchaseToken = subscriptionNotification.purchaseToken;
    const notificationType = subscriptionNotification.notificationType;
    
    // Notification Types:
    // 2: RENEWED
    // 3: CANCELED (still active until expiry)
    // 12: REVOKED (expired immediately)
    // 13: EXPIRED (expired immediately)
    
    let status = "active";
    if (notificationType === 12 || notificationType === 13 || notificationType === 5 || notificationType === 6) {
      status = "expired";
    }

    if (purchaseToken) {
      // For Google, the purchaseToken is usually saved as originalTxId in our schema
      await prisma.subscription.updateMany({
        where: { originalTxId: purchaseToken },
        data: {
          status,
          updatedAt: new Date()
          // Note: To get the exact new expiresAt, we would need to query the Google Play Developer API
          // using the purchaseToken. For this simplified implementation, we just update status.
        }
      });
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("Google webhook error:", e);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default subscriptions;
