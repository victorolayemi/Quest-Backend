import { Hono } from "hono";
import { getDrizzle } from "../../utils/drizzle";
import { Bindings, Variables } from "../../types";
import { checkAndDeductCoins } from "../../utils/economy";
import {
  authMiddleware,
  checkCommunityRestriction,
} from "../../middleware/auth";
import {
  community,
  communityMember,
  communityJoinRequest,
  user,
} from "../../db/schema";
import { eq, or, and, not, like, sql, inArray } from "drizzle-orm";
import crypto from "crypto";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function seedCommunityIfEmpty(db: any) {
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(community);
  const count = Number(countRes[0].count);
  if (count === 0) {
    const comId = crypto.randomUUID();
    return await db
      .insert(community)
      .values({
        id: comId,
        name: "Lekki Christian Youth",
        description:
          "A gathering of young believers in Lekki studying the word, sharing experiences, and raising leaders.",
        image: "/assets/images/community_lekki.jpg",
        guidelines:
          "Be respectful, share edifying content, stay focus on Christ.",
      })
      .returning();
    // Ignoring events seeding here as it's just a seed and events API is separate
  }
}

app.use("*", authMiddleware);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(db);

  // Find communities where the user is a member
  const memberComs = await db
    .select({ communityId: communityMember.communityId })
    .from(communityMember)
    .where(eq(communityMember.userId, userId as string));
  const memberComIds = memberComs.map((m) => m.communityId);

  if (memberComIds.length === 0) {
    return c.json([]);
  }

  let conditions = inArray(community.id, memberComIds);
  if (q) {
    conditions = and(
      conditions,
      or(like(community.name, `%${q}%`), like(community.description, `%${q}%`)),
    )!;
  }

  const listData = await db.query.community.findMany({
    where: conditions,
  });

  const list = await Promise.all(
    listData.map(async (l) => {
      const [mc] = await db
        .select({ count: sql<number>`count(*)` })
        .from(communityMember)
        .where(eq(communityMember.communityId, l.id));

      let authorName = "Sozo";
      if (l.creatorId) {
        const [creator] = await db
          .select({
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          })
          .from(user)
          .where(eq(user.id, l.creatorId));
        if (creator) {
          authorName =
            `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
            creator.username ||
            "Sozo";
        }
      }

      return {
        ...l,
        authorName,
        _count: { members: Number(mc.count) },
      };
    }),
  );

  return c.json(list);
});

app.get("/search", async (c) => {
  const db = getDrizzle(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(db);

  let conditions = undefined;
  if (q) {
    conditions = or(
      like(community.name, `%${q}%`),
      like(community.description, `%${q}%`),
    );
  }

  const listData = await db.query.community.findMany({
    where: conditions,
  });

  const list = await Promise.all(
    listData.map(async (l) => {
      const [mc] = await db
        .select({ count: sql<number>`count(*)` })
        .from(communityMember)
        .where(eq(communityMember.communityId, l.id));

      let authorName = "Unknown Author";
      if (l.creatorId) {
        const [creator] = await db
          .select({
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          })
          .from(user)
          .where(eq(user.id, l.creatorId));
        if (creator) {
          authorName =
            `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
            creator.username ||
            "Unknown Author";
        }
      }

      return {
        ...l,
        authorName,
        _count: { members: Number(mc.count) },
      };
    }),
  );

  return c.json(list);
});

app.get("/recommended", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(db);

  const memberComs = await db
    .select({ communityId: communityMember.communityId })
    .from(communityMember)
    .where(eq(communityMember.userId, userId as string));
  const memberComIds = memberComs.map((m) => m.communityId);

  let conditions =
    memberComIds.length > 0
      ? not(inArray(community.id, memberComIds))
      : undefined;

  if (q) {
    const qCond = or(
      like(community.name, `%${q}%`),
      like(community.description, `%${q}%`),
    );
    conditions = conditions ? and(conditions, qCond) : qCond;
  }

  const list = await db.query.community.findMany({
    where: conditions,
    limit: 3,
  });

  const listWithCounts = await Promise.all(
    list.map(async (l) => {
      const [mc] = await db
        .select({ count: sql<number>`count(*)` })
        .from(communityMember)
        .where(eq(communityMember.communityId, l.id));

      let authorName = "Unknown Author";
      if (l.creatorId) {
        const [creator] = await db
          .select({
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          })
          .from(user)
          .where(eq(user.id, l.creatorId));
        if (creator) {
          authorName =
            `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
            creator.username ||
            "Unknown Author";
        }
      }

      return {
        ...l,
        authorName,
        _count: { members: Number(mc.count) },
      };
    }),
  );

  return c.json(listWithCounts);
});

app.post("/", checkCommunityRestriction, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  // NOTE: economy relies on Prisma for now, passing db as any
  const economyCheck = await checkAndDeductCoins(
    c,
    db as any,
    userId,
    "create_community",
    "Created a new community",
  );
  if (!economyCheck.success) {
    return c.json(
      {
        error: economyCheck.message || "Insufficient coins to create community",
      },
      403,
    );
  }

  const body = (await c.req.json()) as any;
  const {
    name: name2,
    description,
    image,
    guidelines,
    isPrivate = false,
  } = body;
  if (!name2 || !description) {
    return c.json({ error: "Name and description are required" }, 400);
  }
  try {
    const comId = crypto.randomUUID();
    const [com] = await db
      .insert(community)
      .values({
        id: comId,
        name: name2,
        description,
        image,
        guidelines,
        isPrivate: isPrivate !== undefined ? !!isPrivate : undefined,
        creatorId: userId,
      })
      .returning();

    await db.insert(communityMember).values({
      id: crypto.randomUUID(),
      communityId: comId,
      userId,
      role: "ADMIN",
    });

    return c.json(com, 201);
  } catch (error) {
    console.error("Create community error:", error);
    return c.json({ error: "Failed to create community" }, 500);
  }
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);

  const comList = await db.query.community.findMany({
    where: eq(community.id, id),
  });
  const com = comList[0];
  if (!com) return c.json({ error: "Community not found" }, 404);

  const [mc] = await db
    .select({ count: sql<number>`count(*)` })
    .from(communityMember)
    .where(eq(communityMember.communityId, id));

  const members = await db
    .select()
    .from(communityMember)
    .where(
      and(
        eq(communityMember.communityId, id),
        eq(communityMember.userId, userId as string),
      ),
    );
  const member = members[0];

  let hasPendingRequest = false;
  if (!member && com.isPrivate) {
    const existingReqs = await db
      .select()
      .from(communityJoinRequest)
      .where(
        and(
          eq(communityJoinRequest.communityId, id),
          eq(communityJoinRequest.userId, userId as string),
          eq(communityJoinRequest.status, "PENDING"),
        ),
      );
    hasPendingRequest = existingReqs.length > 0;
  }

  let authorName = "Unknown Author";
  if (com.creatorId) {
    const [creator] = await db
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      })
      .from(user)
      .where(eq(user.id, com.creatorId));
    if (creator) {
      authorName =
        `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
        creator.username ||
        "Unknown Author";
    }
  }

  return c.json({
    ...com,
    authorName,
    isPrivate: Boolean(com.isPrivate),
    isForumDisabledGlobally: Boolean(com.isForumDisabledGlobally),
    _count: { members: Number(mc.count) },
    hasJoined: !!member,
    hasPendingRequest,
    member: member
      ? {
          role: member.role,
          isSuspended: Boolean(member.isSuspended),
          canPostForum: Boolean(member.canPostForum),
        }
      : null,
  });
});

app.post("/:id/share", async (c) => {
  return c.json({ shareUrl: `https://quest-app.com/com/${c.req.param("id")}` });
});

app.get("/:id/guidelines", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  const coms = await db
    .select({ guidelines: community.guidelines })
    .from(community)
    .where(eq(community.id, id));
  if (coms.length === 0) return c.json({ error: "Community not found" }, 404);
  return c.json({ guidelines: coms[0].guidelines });
});

app.post("/:id/report", async (c) => {
  return c.json({ message: "Report submitted successfully" });
});

app.put("/:id/settings", async (c) => {
  const communityId = c.req.param("id");
  const adminId = c.get("userId");
  const body = (await c.req.json()) as any;
  const { isForumDisabledGlobally } = body;
  const db = getDrizzle(c.env.DB);

  const members = await db
    .select()
    .from(communityMember)
    .where(
      and(
        eq(communityMember.communityId, communityId),
        eq(communityMember.userId, adminId),
      ),
    );
  const member = members[0];

  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can update community settings" }, 403);
  }

  if (isForumDisabledGlobally !== undefined) {
    await db
      .update(community)
      .set({ isForumDisabledGlobally: !!isForumDisabledGlobally })
      .where(eq(community.id, communityId as string));
  }

  const updatedComs = await db
    .select()
    .from(community)
    .where(eq(community.id, communityId));
  const updated = updatedComs[0];

  return c.json({
    ...updated,
    isPrivate: Boolean(updated.isPrivate),
    isForumDisabledGlobally: Boolean(updated.isForumDisabledGlobally),
  });
});

export default app;
