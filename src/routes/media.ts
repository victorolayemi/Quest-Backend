import { Hono } from "hono";
import { getDrizzle } from "../utils/drizzle";
import { eq, desc, inArray, and, lt, ilike, sql } from "drizzle-orm";
import {
  sermonMedia,
  mediaLike,
  playProgress,
  userMedia,
  subscription,
  appFeature,
  globalSettings,
  user as userTable,
} from "../db/schema";
import { authMiddleware, checkMediaRestriction } from "../middleware/auth";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import admin from "firebase-admin";

// src/routes/media.ts
import { Bindings, Variables } from "../types";
import { grantCoins, checkAndDeductCoins } from "../utils/economy";

var media = new Hono<{ Bindings: Bindings; Variables: Variables }>();
media.get("/download/*", async (c) => {
  const path = c.req.path;
  const key = path.substring(path.indexOf("/download/") + 10);
  if (!c.env.MEDIA_BUCKET) {
    return c.text("R2 Bucket not configured", 500);
  }
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) {
    return c.text("File not found", 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});
media.use("/videos", authMiddleware);
media.use("/videos/*", authMiddleware);
media.use("/audio", authMiddleware);
media.use("/audio/*", authMiddleware);
media.use("/upload", authMiddleware);

media.get("/categories", async (c) => {
  return c.json([
    { id: "faith", name: "Faith" },
    { id: "grace", name: "Grace" },
    { id: "leadership", name: "Leadership" },
    { id: "prayer", name: "Prayer" },
  ]);
});
media.get("/videos", async (c) => {
  const db = getDrizzle(c.env.DB);
  const cursor = c.req.query("cursor");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const userId = c.get("userId");

  let cursorDate = null;
  if (cursor) {
    let s = await db.query.sermonMedia.findFirst({
      where: eq(sermonMedia.id, cursor),
    });
    if (s) cursorDate = s.createdAt;
    else {
      let u = await db.query.userMedia.findFirst({
        where: eq(userMedia.id, cursor),
      });
      if (u) cursorDate = u.createdAt;
    }
  }

  const sConds = [eq(sermonMedia.type, "VIDEO")];
  if (cursorDate) sConds.push(lt(sermonMedia.createdAt, cursorDate as string));
  if (search) sConds.push(ilike(sermonMedia.title, `%${search}%`));

  const sVideosData = await db.query.sermonMedia.findMany({
    where: and(...sConds),
    orderBy: [desc(sermonMedia.createdAt)],
    limit: limit + 1,
  });

  const sVideos = await Promise.all(
    sVideosData.map(async (v) => {
      const [likeCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaLike)
        .where(eq(mediaLike.mediaId, v.id));
      return { ...v, _count: Number(likeCount.count) };
    }),
  );

  const uConds = [eq(userMedia.type, "video")];
  if (cursorDate) uConds.push(lt(userMedia.createdAt, cursorDate));
  if (search) uConds.push(ilike(userMedia.title, `%${search}%`));

  const uVideos = await db.query.userMedia.findMany({
    where: and(...uConds),
    orderBy: [desc(userMedia.createdAt)],
    limit: limit + 1,
    with: { user: true },
  });

  let likedMediaIds: string[] = [];
  if (userId) {
    const allIds = [...sVideos.map((v) => v.id), ...uVideos.map((v) => v.id)];
    if (allIds.length > 0) {
      const likes = await db
        .select({ mediaId: mediaLike.mediaId })
        .from(mediaLike)
        .where(
          and(eq(mediaLike.userId, userId), inArray(mediaLike.mediaId, allIds)),
        );
      likedMediaIds = likes.map((l) => l.mediaId);
    }
  }

  const sItems = sVideos.map((v) => ({
    ...v,
    hasLiked: likedMediaIds.includes(v.id),
    likes: v._count || 0,
    mediaLikes: undefined,
    _count: undefined,
  }));

  const uItems = uVideos.map((v) => ({
    id: v.id,
    title: v.title,
    author: `${v.user.firstName} ${v.user.lastName}`,
    mediaUrl: v.mediaUrl,
    imageUrl: v.imageUrl || "",
    type: "VIDEO",
    duration: "00:00",
    category: "Reel",
    createdAt: v.createdAt,
    hasLiked: likedMediaIds.includes(v.id),
    likes: 0,
  }));

  const allItems = [...sItems, ...uItems].sort(
    (a, b) =>
      new Date(b.createdAt as string).getTime() -
      new Date(a.createdAt as string).getTime(),
  );

  const hasMore = allItems.length > limit;
  const itemsRaw = hasMore ? allItems.slice(0, limit) : allItems;
  const nextCursor = hasMore ? itemsRaw[itemsRaw.length - 1].id : null;

  return c.json({
    items: itemsRaw,
    nextCursor,
    hasMore,
  });
});
media.get("/videos/continue", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const recentPlays = await db.query.playProgress.findMany({
    where: and(
      eq(playProgress.userId, userId),
      eq(playProgress.completed, false),
    ),
    orderBy: [desc(playProgress.updatedAt)],
    limit: 20,
  });

  // We have to query the relationships manually since they might not be defined in schema relations
  const playProgressWithMedia = [];
  for (const r of recentPlays) {
    const s = await db.query.sermonMedia.findFirst({
      where: eq(sermonMedia.id, r.mediaId),
    });
    const u = s
      ? null
      : await db.query.userMedia.findFirst({
          where: eq(userMedia.id, r.mediaId),
        });
    playProgressWithMedia.push({ ...r, sermonMedia: s, userMedia: u });
  }

  let result = null;
  for (const r of playProgressWithMedia) {
    let media = r.sermonMedia;
    let uMedia = r.userMedia;
    if (media && media.type === "VIDEO") {
      result = { ...r, media };
      break;
    } else if (uMedia && uMedia.type === "video") {
      result = { ...r, media: { ...uMedia, _count: { mediaLikes: 0 } } };
      break;
    }
  }

  if (result && result.media && result.media.type === "VIDEO") {
    const like = await db.query.mediaLike.findFirst({
      where: and(
        eq(mediaLike.userId, userId),
        eq(mediaLike.mediaId, result.media.id),
      ),
    });
    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, result.media.id));
    const item = {
      ...result.media,
      hasLiked: !!like,
      likes: likesCountRes[0].count,
      _count: void 0,
      progressSeconds: result.progressSeconds,
    };
    return c.json({ item });
  } else if (result && result.media) {
    const like = await db.query.mediaLike.findFirst({
      where: and(
        eq(mediaLike.userId, userId),
        eq(mediaLike.mediaId, result.media.id),
      ),
    });
    const item = {
      ...result.media,
      hasLiked: !!like,
      likes: 0,
      _count: void 0,
      progressSeconds: result.progressSeconds,
    };
    return c.json({ item });
  }

  return c.json({ item: null });
});
media.get("/videos/categories", async (c) => {
  return c.json([
    { id: "sermons", name: "Sermons" },
    { id: "interviews", name: "Interviews" },
  ]);
});
media.get("/videos/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const item = await db.query.sermonMedia.findFirst({
    where: and(eq(sermonMedia.id, id), eq(sermonMedia.type, "VIDEO")),
  });

  if (!item) {
    return c.json({ error: "Video not found" }, 404);
  }

  let isLiked = false;
  if (userId) {
    const like = await db.query.mediaLike.findFirst({
      where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)),
    });
    isLiked = !!like;
  }

  const likesCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaLike)
    .where(eq(mediaLike.mediaId, id));

  return c.json({
    ...item,
    isLiked,
    _count: { mediaLikes: likesCountRes[0].count },
  });
});
media.post("/videos/:id/like", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const sermonMediaRes = await db.query.sermonMedia.findFirst({
    where: eq(sermonMedia.id, id),
  });

  if (!sermonMediaRes) {
    return c.json(
      { message: "Media not found in SermonMedia (likely a Reel)" },
      404,
    );
  }

  const existingLike = await db.query.mediaLike.findFirst({
    where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)),
  });

  if (existingLike) {
    await db.delete(mediaLike).where(eq(mediaLike.id, existingLike.id));
    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, id));
    return c.json({
      message: "Unliked",
      likes: likesCountRes[0].count,
      hasLiked: false,
    });
  } else {
    await db
      .insert(mediaLike)
      .values({ id: crypto.randomUUID(), userId, mediaId: id });

    // Grant 10 coins for engaging
    const _db = getDrizzle(c.env.DB);
    const coinRes = await grantCoins(_db, userId, 10, "Like Video");

    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, id));

    return c.json({
      message: "Liked",
      likes: likesCountRes[0].count,
      hasLiked: true,
      coinBalance: coinRes?.newBalance,
    });
  }
});
media.post("/videos/:id/play", async (c) => {
  const userId = c.get("userId");
  const mediaId = c.req.param("id");
  const body = await c.req.json();
  const { progressSeconds, completed } = body;
  const db = getDrizzle(c.env.DB);

  const sermonMediaRes = await db.query.sermonMedia.findFirst({
    where: eq(sermonMedia.id, mediaId),
  });

  let existing = await db.query.playProgress.findFirst({
    where: and(
      eq(playProgress.userId, userId),
      eq(playProgress.mediaId, mediaId),
    ),
  });

  let record;
  if (existing) {
    record = await db
      .update(playProgress)
      .set({
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      })
      .where(eq(playProgress.id, existing.id))
      .returning();
    record = record[0];
  } else {
    record = await db
      .insert(playProgress)
      .values({
        id: crypto.randomUUID(),
        userId,
        mediaId: mediaId as string,
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      })
      .returning();
    record = record[0];
  }

  let coinRes;
  if (completed && sermonMediaRes?.type === "VIDEO") {
    // Reward points
    await db
      .update(userTable)
      .set({
        points: sql`${userTable.points} + 20`,
        videoReelPoints: sql`${userTable.videoReelPoints} + 20`,
      })
      .where(eq(userTable.id, userId));

    coinRes = await grantCoins(db, userId, 20, "Complete Video");
  }

  return c.json({ ...record, coinBalance: coinRes?.newBalance });
});
media.get("/audio", async (c) => {
  const db = getDrizzle(c.env.DB);
  const cursor = c.req.query("cursor");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const userId = c.get("userId");

  let cursorDate = null;
  if (cursor) {
    let s = await db.query.sermonMedia.findFirst({
      where: eq(sermonMedia.id, cursor as string),
    });
    if (s) cursorDate = s.createdAt;
    else {
      let u = await db.query.userMedia.findFirst({
        where: eq(userMedia.id, cursor as string),
      });
      if (u) cursorDate = u.createdAt;
    }
  }

  const sConds = [eq(sermonMedia.type, "AUDIO")];
  if (cursorDate) sConds.push(lt(sermonMedia.createdAt, cursorDate as string));
  if (search) sConds.push(ilike(sermonMedia.title, `%${search}%`));

  const sAudiosData = await db.query.sermonMedia.findMany({
    where: and(...sConds),
    orderBy: [desc(sermonMedia.createdAt)],
    limit: limit + 1,
  });

  const sAudios = await Promise.all(
    sAudiosData.map(async (a) => {
      const [likeCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaLike)
        .where(eq(mediaLike.mediaId, a.id));
      return { ...a, _count: Number(likeCount.count) };
    }),
  );

  const uConds = [eq(userMedia.type, "audio")];
  if (cursorDate) uConds.push(lt(userMedia.createdAt, cursorDate));
  if (search) uConds.push(ilike(userMedia.title, `%${search}%`));

  const uAudios = await db.query.userMedia.findMany({
    where: and(...uConds),
    orderBy: [desc(userMedia.createdAt)],
    limit: limit + 1,
    with: { user: true },
  });

  let likedMediaIds: string[] = [];
  if (userId) {
    const allIds = [...sAudios.map((v) => v.id), ...uAudios.map((v) => v.id)];
    if (allIds.length > 0) {
      const likes = await db
        .select({ mediaId: mediaLike.mediaId })
        .from(mediaLike)
        .where(
          and(eq(mediaLike.userId, userId), inArray(mediaLike.mediaId, allIds)),
        );
      likedMediaIds = likes.map((l) => l.mediaId);
    }
  }

  const sItems = sAudios.map((a) => ({
    ...a,
    hasLiked: likedMediaIds.includes(a.id),
    likes: a._count || 0,
    mediaLikes: undefined,
    _count: undefined,
  }));

  const uItems = uAudios.map((a) => ({
    id: a.id,
    title: a.title,
    author: `${a.user.firstName} ${a.user.lastName}`,
    mediaUrl: a.mediaUrl,
    imageUrl: a.imageUrl || "",
    type: "AUDIO",
    duration: "00:00",
    category: "Reel",
    createdAt: a.createdAt,
    hasLiked: likedMediaIds.includes(a.id),
    likes: 0,
  }));

  const allItems = [...sItems, ...uItems].sort(
    (a, b) =>
      new Date(b.createdAt as string).getTime() -
      new Date(a.createdAt as string).getTime(),
  );

  const hasMore = allItems.length > limit;
  const itemsRaw = hasMore ? allItems.slice(0, limit) : allItems;
  const nextCursor = hasMore ? itemsRaw[itemsRaw.length - 1].id : null;

  return c.json({
    items: itemsRaw,
    nextCursor,
    hasMore,
  });
});
media.get("/audio/continue", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const recentPlays = await db.query.playProgress.findMany({
    where: and(
      eq(playProgress.userId, userId),
      eq(playProgress.completed, false),
    ),
    orderBy: [desc(playProgress.updatedAt)],
    limit: 20,
  });

  const playProgressWithMedia = [];
  for (const r of recentPlays) {
    const s = await db.query.sermonMedia.findFirst({
      where: eq(sermonMedia.id, r.mediaId),
    });
    const u = s
      ? null
      : await db.query.userMedia.findFirst({
          where: eq(userMedia.id, r.mediaId),
        });
    playProgressWithMedia.push({ ...r, sermonMedia: s, userMedia: u });
  }

  let result = null;
  for (const r of playProgressWithMedia) {
    let media = r.sermonMedia;
    let uMedia = r.userMedia;
    if (media && media.type === "AUDIO") {
      result = { ...r, media };
      break;
    } else if (uMedia && uMedia.type === "audio") {
      result = { ...r, media: { ...uMedia, _count: { mediaLikes: 0 } } };
      break;
    }
  }

  if (result && result.media && result.media.type === "AUDIO") {
    const like = await db.query.mediaLike.findFirst({
      where: and(
        eq(mediaLike.userId, userId),
        eq(mediaLike.mediaId, result.media.id),
      ),
    });
    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, result.media.id));
    const item = {
      ...result.media,
      hasLiked: !!like,
      likes: likesCountRes[0].count,
      _count: void 0,
      progressSeconds: result.progressSeconds,
    };
    return c.json({ item });
  } else if (result && result.media) {
    const like = await db.query.mediaLike.findFirst({
      where: and(
        eq(mediaLike.userId, userId),
        eq(mediaLike.mediaId, result.media.id),
      ),
    });
    const item = {
      ...result.media,
      hasLiked: !!like,
      likes: 0,
      _count: void 0,
      progressSeconds: result.progressSeconds,
    };
    return c.json({ item });
  }

  return c.json({ item: null });
});
media.get("/audio/categories", async (c) => {
  return c.json([
    { id: "podcasts", name: "Podcasts" },
    { id: "worship", name: "Worship Music" },
    { id: "audiobooks", name: "Audiobooks" },
  ]);
});
media.get("/audio/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const item = await db.query.sermonMedia.findFirst({
    where: and(eq(sermonMedia.id, id), eq(sermonMedia.type, "AUDIO")),
  });

  if (!item) {
    return c.json({ error: "Audio not found" }, 404);
  }

  let isLiked = false;
  if (userId) {
    const like = await db.query.mediaLike.findFirst({
      where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)),
    });
    isLiked = !!like;
  }

  const likesCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaLike)
    .where(eq(mediaLike.mediaId, id));

  return c.json({
    ...item,
    isLiked,
    _count: { mediaLikes: likesCountRes[0].count },
  });
});
media.post("/audio/:id/like", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const sermonMediaRes = await db.query.sermonMedia.findFirst({
    where: eq(sermonMedia.id, id),
  });

  if (!sermonMediaRes) {
    return c.json(
      { message: "Media not found in SermonMedia (likely a Reel)" },
      404,
    );
  }

  const existingLike = await db.query.mediaLike.findFirst({
    where: and(eq(mediaLike.userId, userId), eq(mediaLike.mediaId, id)),
  });

  if (existingLike) {
    await db.delete(mediaLike).where(eq(mediaLike.id, existingLike.id));
    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, id));
    return c.json({
      message: "Unliked",
      likes: likesCountRes[0].count,
      hasLiked: false,
    });
  } else {
    await db
      .insert(mediaLike)
      .values({ id: crypto.randomUUID(), userId, mediaId: id });

    // Grant 10 coins for engaging
    const _db = getDrizzle(c.env.DB);
    const coinRes = await grantCoins(_db, userId, 10, "Like Audio");

    const likesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaLike)
      .where(eq(mediaLike.mediaId, id));

    return c.json({
      message: "Liked",
      likes: likesCountRes[0].count,
      hasLiked: true,
      coinBalance: coinRes?.newBalance,
    });
  }
});
media.post("/audio/:id/play", async (c) => {
  const userId = c.get("userId");
  const mediaId = c.req.param("id");
  const body = await c.req.json();
  const { progressSeconds, completed } = body;
  const db = getDrizzle(c.env.DB);

  const sermonMediaRes = await db.query.sermonMedia.findFirst({
    where: eq(sermonMedia.id, mediaId),
  });

  let existing = await db.query.playProgress.findFirst({
    where: and(
      eq(playProgress.userId, userId),
      eq(playProgress.mediaId, mediaId),
    ),
  });

  let record;
  if (existing) {
    record = await db
      .update(playProgress)
      .set({
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      })
      .where(eq(playProgress.id, existing.id))
      .returning();
    record = record[0];
  } else {
    record = await db
      .insert(playProgress)
      .values({
        id: crypto.randomUUID(),
        userId,
        mediaId: mediaId as string,
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      })
      .returning();
    record = record[0];
  }

  let coinRes;
  if (completed && sermonMediaRes?.type === "AUDIO") {
    // Reward points
    await db
      .update(userTable)
      .set({
        points: sql`${userTable.points} + 20`,
        audioReelPoints: sql`${userTable.audioReelPoints} + 20`,
      })
      .where(eq(userTable.id, userId));

    coinRes = await grantCoins(db, userId, 20, "Complete Audio");
  }

  return c.json({ ...record, coinBalance: coinRes?.newBalance });
});
media.get("/upload/limit-check", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const activeSubscription = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.userId, userId),
      eq(subscription.status, "active"),
      sql`${subscription.expiresAt} > CURRENT_TIMESTAMP`,
    ),
  });

  if (activeSubscription) {
    return c.json({ limitReached: false, isPro: true, used: 0, limit: -1 });
  }

  const feature = await db.query.appFeature.findFirst({
    where: eq(appFeature.key, "free_media_posts_limit"),
  });

  let limit = 3;
  if (feature?.value) {
    const parsed = parseInt(feature.value, 10);
    if (!isNaN(parsed)) limit = parsed;
  }

  const usedRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(userMedia)
    .where(eq(userMedia.userId, userId));
  const used = usedRes[0].count;

  return c.json({ limitReached: used >= limit, isPro: false, used, limit });
});

media.post("/upload", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const formData = await c.req.formData();
  const file = formData.get("file");
  const title = formData.get("title") || "Untitled";

  let fileType = (file as File).type || "";
  let derivedType = "audio";
  if (fileType.startsWith("video/")) {
    derivedType = "video";
  } else {
    const name = ((file as File).name || "").toLowerCase();
    if (
      name.endsWith(".mp4") ||
      name.endsWith(".mov") ||
      name.endsWith(".mkv") ||
      name.endsWith(".webm") ||
      name.endsWith(".avi")
    ) {
      derivedType = "video";
    }
  }
  const type = formData.get("type") || derivedType;
  const isEdit = formData.get("isEdit") === "true";
  const isReel = formData.get("isReel") === "true";
  if (!file) {
    return c.json({ error: 'No file provided in form-data key "file"' }, 400);
  }

  const globalSettingsRes = await db.query.globalSettings.findFirst({
    where: eq(globalSettings.id, "default"),
  });
  const settings =
    globalSettingsRes ||
    ({
      videoUploadSizeLimitMB: 50,
      audioUploadSizeLimitMB: 50,
      devotionVideoSizeLimitMB: 50,
      videoUploadDurationLimitSec: 300,
      audioUploadDurationLimitSec: 1800,
      devotionVideoDurationLimitSec: 300,
    } as any);

  const fileSizeInMB = (file as File).size / (1024 * 1024);
  if (type === "video" && fileSizeInMB > settings.videoUploadSizeLimitMB) {
    return c.json(
      {
        error: `Video file exceeds the limit of ${settings.videoUploadSizeLimitMB}MB.`,
      },
      400,
    );
  }
  if (type === "audio" && fileSizeInMB > settings.audioUploadSizeLimitMB) {
    return c.json(
      {
        error: `Audio file exceeds the limit of ${settings.audioUploadSizeLimitMB}MB.`,
      },
      400,
    );
  }

  const userRes = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { isBanned: true, mediaRestrictionExpiry: true },
  });

  if (userRes?.isBanned) {
    return c.json({ error: "Your account is banned." }, 403);
  }

  if (
    userRes?.mediaRestrictionExpiry &&
    new Date(userRes.mediaRestrictionExpiry) > new Date()
  ) {
    return c.json(
      {
        error: `Your account is restricted from posting media until ${new Date(userRes.mediaRestrictionExpiry).toLocaleDateString()}.`,
      },
      403,
    );
  }

  if (isReel && !isEdit) {
    const actionType = type === "video" ? "post_video" : "post_audio";
    const economyCheck = await checkAndDeductCoins(
      c,
      db,
      userId,
      actionType,
      `Posted a ${type} reel`,
    );
    if (!economyCheck.success) {
      return c.json(
        { error: economyCheck.message || "Insufficient coins to post media" },
        403,
      );
    }
  }

  const fileKey = `uploads/${Date.now()}-${(file as File).name}`;
  const fileBuffer = await (file as File).arrayBuffer();
  if (c.env.MEDIA_BUCKET) {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: (file as File).type },
    });
  }
  const origin = new URL(c.req.url).origin;
  const fileUrl = `${origin}/api/v1/media/download/${fileKey}`;

  const thumbnail = formData.get("thumbnail");
  let imageUrl = null;
  if (thumbnail && c.env.MEDIA_BUCKET) {
    const thumbKey = `uploads/${Date.now()}-thumb-${(thumbnail as File).name}`;
    const thumbBuffer = await (thumbnail as File).arrayBuffer();
    await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
      httpMetadata: { contentType: (thumbnail as File).type },
    });
    imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
  }

  if (isReel && !isEdit) {
    await db.insert(userMedia).values({
      id: crypto.randomUUID(),
      userId,
      title: title as string,
      mediaUrl: fileUrl,
      imageUrl,
      type: type as string,
    });
  }
  return c.json({
    message: "File uploaded successfully to R2",
    fileUrl,
    imageUrl,
    url: fileUrl,
  });
});
media.delete("/file", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json();
  const { fileUrl } = body;
  if (!fileUrl) {
    return c.json({ error: "fileUrl is required" }, 400);
  }

  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { isAdmin: true },
  });
  const isAdmin = user?.isAdmin || false;

  if (!isAdmin) {
    const existingMedia = await db.query.userMedia.findFirst({
      where: and(eq(userMedia.mediaUrl, fileUrl), eq(userMedia.userId, userId)),
    });
    if (!existingMedia) {
      return c.json({ error: "Unauthorized or file not found" }, 403);
    }
  }

  const downloadPath = "/api/v1/media/download/";
  const idx = fileUrl.indexOf(downloadPath);
  if (idx === -1) {
    return c.json({ error: "Invalid fileUrl format" }, 400);
  }
  const key = fileUrl.substring(idx + downloadPath.length);
  if (c.env.MEDIA_BUCKET) {
    try {
      await c.env.MEDIA_BUCKET.delete(key);
      if (isAdmin) {
        await db.delete(sermonMedia).where(eq(sermonMedia.mediaUrl, fileUrl));
      }
      await db.delete(userMedia).where(eq(userMedia.mediaUrl, fileUrl));
    } catch (e) {
      console.error("Error deleting file from R2:", e);
      return c.json({ error: "Failed to delete file from R2" }, 500);
    }
  } else {
    return c.json({ error: "R2 Bucket not configured" }, 500);
  }
  return c.json({ message: "File deleted permanently" });
});

media.get("/user/created", authMiddleware, async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const result = await db.query.userMedia.findMany({
    where: eq(userMedia.userId, userId),
    orderBy: [desc(userMedia.createdAt)],
  });
  return c.json(result);
});

media.put("/user/:id", authMiddleware, async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const mediaId = c.req.param("id") as string;

  const existingMedia = await db.query.userMedia.findFirst({
    where: eq(userMedia.id, mediaId),
  });

  if (!existingMedia) return c.json({ error: "Media not found" }, 404);
  if (existingMedia.userId !== userId)
    return c.json({ error: "Unauthorized" }, 403);

  const reqData = await c.req.json();
  const updatedMedia = await db
    .update(userMedia)
    .set({
      title: reqData.title !== undefined ? reqData.title : existingMedia.title,
    })
    .where(eq(userMedia.id, mediaId))
    .returning();

  return c.json({
    message: "Media updated successfully",
    media: updatedMedia[0],
  });
});

media.delete("/user/:id", authMiddleware, async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId");
  const mediaId = c.req.param("id") as string;

  const existingMedia = await db.query.userMedia.findFirst({
    where: eq(userMedia.id, mediaId),
  });

  if (!existingMedia) return c.json({ error: "Media not found" }, 404);
  if (existingMedia.userId !== userId)
    return c.json({ error: "Unauthorized" }, 403);

  if (c.env.MEDIA_BUCKET) {
    const downloadPath = "/api/v1/media/download/";
    if (existingMedia.mediaUrl) {
      const idx = existingMedia.mediaUrl.indexOf(downloadPath);
      if (idx !== -1) {
        const key = existingMedia.mediaUrl.substring(idx + downloadPath.length);
        await c.env.MEDIA_BUCKET.delete(key).catch(console.error);
      }
    }
    if (existingMedia.imageUrl) {
      const idx = existingMedia.imageUrl.indexOf(downloadPath);
      if (idx !== -1) {
        const key = existingMedia.imageUrl.substring(idx + downloadPath.length);
        await c.env.MEDIA_BUCKET.delete(key).catch(console.error);
      }
    }
  }

  await db.delete(userMedia).where(eq(userMedia.id, mediaId));
  return c.json({ message: "Media deleted successfully" });
});

export default media;
