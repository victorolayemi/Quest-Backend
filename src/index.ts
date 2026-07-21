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

import { FCMService } from "./services/fcm";
import { dispatchNotification } from "./services/notificationService";
import { getPrisma } from "./utils/prisma";

import { Hono } from "hono";
import { cors } from "hono/cors";

// src/index.ts
var app = new Hono();
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
    const prisma = getPrisma(env.DB);
    const fiveDaysAgo = /* @__PURE__ */ new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const sevenDaysAgo = /* @__PURE__ */ new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    try {
      const inactiveUsers = await prisma.user.findMany({
        where: {
          fcmToken: { not: null },
          // A simple approximation: if they haven't had login history recently,
          // or their createdAt is old and they have no recent history.
          // In a fully robust system, you'd track `lastActiveAt` on the User model.
          loginHistory: {
            none: {
              createdAt: {
                gte: fiveDaysAgo,
              },
            },
          },
        },
        select: { id: true, fcmToken: true },
      });
      if (inactiveUsers.length === 0) return;
      if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
        console.error("Firebase credentials missing for cron job");
        return;
      }
      const fcm = new FCMService(
        env.FIREBASE_CLIENT_EMAIL,
        env.FIREBASE_PRIVATE_KEY,
      );
      const usersToNotify = inactiveUsers.slice(0, 100);
      await Promise.all(
        usersToNotify.map(async (u) => {
          try {
            await fcm.sendNotification({
              token: u.fcmToken,
              notification: {
                title: "We miss you! \u{1F44B}",
                body: "Come back and continue your spiritual journey with Quest.",
              },
            });
          } catch (e) {
            console.error(`Failed to notify user ${u.id}:`, e);
          }
        }),
      );
    } catch (error) {
      console.error("Error in scheduled notification job:", error);
    }
  },
};
export default index_default;
