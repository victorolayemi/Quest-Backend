import { Hono } from "hono";
import { getDrizzle } from "../utils/drizzle";
import { authMiddleware } from "../middleware/auth";
import { Bindings, Variables } from "../types";
import { subscription } from "../db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { SignJWT, importPKCS8 } from "jose";

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
  let computedExpiresAt = new Date();
  computedExpiresAt.setMonth(computedExpiresAt.getMonth() + 1);
  let isValid = false;

  try {
    if (platform === "ios") {
      if (!c.env.APPLE_SHARED_SECRET) {
         return c.json({ error: "APPLE_SHARED_SECRET not configured" }, 500);
      }
      let url = "https://buy.itunes.apple.com/verifyReceipt";
      let response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "receipt-data": receiptData, password: c.env.APPLE_SHARED_SECRET })
      });
      let data = (await response.json()) as any;
      if (data.status === 21007) {
        url = "https://sandbox.itunes.apple.com/verifyReceipt";
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "receipt-data": receiptData, password: c.env.APPLE_SHARED_SECRET })
        });
        data = (await response.json()) as any;
      }
      if (data.status === 0) {
        isValid = true;
        if (data.latest_receipt_info && data.latest_receipt_info.length > 0) {
          computedExpiresAt = new Date(parseInt(data.latest_receipt_info[0].expires_date_ms));
        }
      }
    } else if (platform === "android") {
      if (!c.env.GOOGLE_SERVICE_ACCOUNT_JSON || !c.env.ANDROID_PACKAGE_NAME) {
         return c.json({ error: "Google credentials not configured" }, 500);
      }
      const credentials = JSON.parse(c.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const privateKey = await importPKCS8(credentials.private_key, 'RS256');
      const jwt = await new SignJWT({
        iss: credentials.client_email,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
        
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });
      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData.access_token;

      if (!accessToken) {
         return c.json({ error: "Failed to get Google access token" }, 500);
      }

      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${c.env.ANDROID_PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${receiptData}`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (verifyRes.ok) {
        const verifyData = (await verifyRes.json()) as any;
        isValid = true;
        if (verifyData.expiryTimeMillis) {
           computedExpiresAt = new Date(parseInt(verifyData.expiryTimeMillis));
        }
      }
    } else {
      return c.json({ error: "Unsupported platform" }, 400);
    }

    if (!isValid) {
      return c.json({ error: "Invalid receipt" }, 400);
    }

    const expiresAtStr = computedExpiresAt.toISOString();

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
