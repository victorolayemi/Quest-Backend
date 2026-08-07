// @ts-nocheck

import { adminAuthMiddleware } from "./middleware/adminAuth";
import { csrf } from "hono/csrf";
import users from "./routes/users";
import friends from "./routes/friends";
import auth from "./routes/auth";
import communities from "./routes/communities";
import games from "./routes/games";
import questionsRouter from "./routes/questions";
import contentAdmin from "./routes/contentAdmin";
import admin from "./routes/admin";
import moderationAdmin from "./routes/moderationAdmin";
import chats from "./routes/chats";
import devotions from "./routes/devotions";
import books from "./routes/books";
import feed from "./routes/feed";
import bible from "./routes/bible";
import quizzes from "./routes/quizzes";
import journals from "./routes/journals";
import challenges from "./routes/challenges";
import dailyBread from "./routes/dailyBread";
import misc from "./routes/misc";
import communityAdmin from "./routes/communityAdmin";
import gamesAdmin from "./routes/gamesAdmin";
import notifications from "./routes/notifications";
import media from "./routes/media";
import notesRouter from "./routes/notes";
import subscriptions from "./routes/subscriptions";
import gamificationAdmin from "./routes/gamificationAdmin";
import badges from "./routes/badges";
import reports from "./routes/reports";
import economy from "./routes/economy";
import settings from "./routes/settings";

import { FCMService } from "./services/fcm";
import { dispatchNotification } from "./services/notificationService";
import { getDrizzle } from "./utils/drizzle";
import { user as userTable, loginHistory } from "./db/schema";
import { isNotNull, notInArray, gt, sql } from "drizzle-orm";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatDates } from "./utils/format";

// src/index.ts
var app = new Hono();
app.use('*', async (c, next) => {
  const originalJson = c.json;
  c.json = function (obj: any, ...args: any[]) {
    return originalJson.call(this, formatDates(obj), ...args);
  } as any;
  await next();
});
app.use("*", cors());
app.route("/api/v1/auth", auth);
app.route("/api/v1/users", users);
app.route("/api/v1/quizzes", quizzes);
app.route("/api/v1/questions", questionsRouter);
app.route("/api/v1/daily-bread", dailyBread);
app.route("/api/v1/challenges", challenges);
app.route("/api/v1/badges", badges);
app.route("/api/v1/friends", friends);
app.route("/api/v1/bible", bible);
app.route("/api/v1/communities", communities);
app.route("/api/v1/journals", journals);
app.route("/api/v1/notes", notesRouter);
app.route("/api/v1/chats", chats);
app.route("/api/v1/devotions", devotions);
app.route("/api/v1/media", media);
app.route("/api/v1/feed", feed);
app.route("/api/v1/explore", feed);
app.route("/api/v1/notifications", notifications);
app.route("/api/v1/subscriptions", subscriptions);
app.route("/api/v1/reports", reports);
app.route("/api/v1/economy", economy);
app.route("/api/v1/settings", settings);
app.use("/api/v1/admin/*", csrf());
app.use("/api/v1/admin/*", adminAuthMiddleware);
app.route("/api/v1/admin", admin);
app.route("/api/v1/admin/games", gamesAdmin);
app.route("/api/v1/admin/content", contentAdmin);
app.route("/api/v1/admin/community", communityAdmin);
app.route("/api/v1/admin/gamification", gamificationAdmin);
app.route("/api/v1/admin/moderation", moderationAdmin);
app.route("/api/v1/games", games);
app.route("/api/v1/books", books);
app.route("/api/v1", misc);
app.get("/.well-known/assetlinks.json", (c) => {
  return c.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.sozo.tribe",
        sha256_cert_fingerprints: [
          "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5",
        ],
      },
    },
  ]);
});
app.get("/.well-known/apple-app-site-association", (c) => {
  return c.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "7AL9TMZU75.com.sozo.tribe",
          paths: ["/community/*", "/post/*", "/devotion/*", "/game/*"],
        },
      ],
    },
  });
});
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api")) {
    return c.json({ error: "Not Found" }, 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
  }
  return c.text("Not Found", 404);
});
app.get("/ws/challenges/battle/:id", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      server.send(
        JSON.stringify({
          event: "battle_broadcast",
          sender: "server",
          data: {
            msg: `Update received: ${data.msg || "ok"}`,
            timestamp: Date.now(),
          },
        }),
      );
    } catch (e) {
      server.send(JSON.stringify({ error: "Invalid JSON payload" }));
    }
  });
  server.addEventListener("close", () => {
    console.log("Battle socket closed");
  });
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});
app.get("/ws/chats/:chatId", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      server.send(
        JSON.stringify({
          event: "chat_echo",
          text: data.text || "",
          createdAt: /* @__PURE__ */ new Date().toISOString(),
        }),
      );
    } catch (e) {
      server.send(JSON.stringify({ error: "Invalid JSON payload" }));
    }
  });
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});
var index_default = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    console.log(`Cron triggered: ${event.cron}`);
    const db = getDrizzle(env.DB);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString();
    try {
      // Find users with fcmToken who have NOT logged in in the last 5 days
      const recentlyActiveUserIds = await db
        .select({ userId: loginHistory.userId })
        .from(loginHistory)
        .where(gt(loginHistory.createdAt, fiveDaysAgoStr));

      const activeIds = recentlyActiveUserIds.map((r: any) => r.userId);

      const inactiveUsers = await db
        .select({ id: userTable.id, fcmToken: userTable.fcmToken })
        .from(userTable)
        .where(
          activeIds.length > 0
            ? notInArray(userTable.id, activeIds) 
            : isNotNull(userTable.fcmToken)
        );

      const filteredInactive = inactiveUsers.filter((u: any) => u.fcmToken !== null);
      if (filteredInactive.length === 0) return;
      
      const usersToNotify = filteredInactive.slice(0, 100);
      
      // Dispatch to Queue instead of sending synchronously
      const messages = usersToNotify.map(u => ({
        body: { userId: u.id, fcmToken: u.fcmToken }
      }));
      
      // Send in batches of 100 to the queue
      for (let i = 0; i < messages.length; i += 100) {
        await env.NOTIFICATION_QUEUE.sendBatch(messages.slice(i, i + 100));
      }
      
    } catch (error) {
      console.error("Error in scheduled notification job:", error);
    }
  },
  async queue(batch: any, env: any, ctx: any) {
    if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      console.error("Firebase credentials missing for queue job");
      return;
    }
    const fcm = new FCMService(
      env.FIREBASE_CLIENT_EMAIL,
      env.FIREBASE_PRIVATE_KEY,
    );

    await Promise.all(
      batch.messages.map(async (msg: any) => {
        try {
          await fcm.sendNotification({
            token: msg.body.fcmToken,
            notification: {
              title: "We miss you! \u{1F44B}",
              body: "Come back and continue your spiritual journey with Quest.",
            },
          });
          msg.ack();
        } catch (e) {
          console.error(`Failed to notify user ${msg.body.userId}:`, e);
          msg.retry();
        }
      })
    );
  }
};
export default index_default;
