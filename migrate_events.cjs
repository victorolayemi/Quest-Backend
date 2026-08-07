const fs = require('fs');

const code = `import { Hono } from 'hono';
import { getDb } from '../../utils/drizzle';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';
import { communityEvent, eventAttendee, communityMember } from '../../db/schema';
import { eq, or, and, not, like, sql, inArray, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

app.get("/:id/events", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const db = getDb(c.env.DB);
  
  const list = await db.query.communityEvent.findMany({
    where: eq(communityEvent.communityId, communityId),
    limit: 20,
    orderBy: [desc(communityEvent.createdAt)],
    with: {
      attendees: true
    }
  });
  return c.json(list);
});

app.post("/:id/events", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, description, date, time, location, link, imageUrl } = body;
  const db = getDb(c.env.DB);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
  });
  if (!mem || mem.role !== "ADMIN") {
    return c.json({ error: "Only admins can create events" }, 403);
  }
  
  const eventId = crypto.randomUUID();
  const [event] = await db.insert(communityEvent).values({
    id: eventId,
    communityId,
    title,
    description,
    date,
    time,
    location,
    link,
    imageUrl,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  await db.insert(eventAttendee).values({
    id: crypto.randomUUID(),
    eventId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const members = await db.select({ userId: communityMember.userId }).from(communityMember).where(and(eq(communityMember.communityId, communityId), not(eq(communityMember.userId, userId))));
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  
  for (const m of members) {
    await dispatchNotification({
      db,
      userId: m.userId,
      title: "New Community Event",
      message: \`A new event "\${title}" was created in your community.\`,
      type: "COMMUNITY_EVENT",
      pushSettingKey: "pushCommunityUpdates",
      fcm,
      data: { type: "COMMUNITY_EVENT", eventId, communityId }
    });
  }
  return c.json(event);
});

app.put("/:id/events/:eventId", async (c) => {
  const communityId = c.req.param("id");
  const eventId = c.req.param("eventId");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, description, date, time, location, link, imageUrl } = body;
  const db = getDb(c.env.DB);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
  });
  if (!mem || mem.role !== "ADMIN") {
    return c.json({ error: "Only admins can edit events" }, 403);
  }
  
  const ev = await db.query.communityEvent.findFirst({ where: eq(communityEvent.id, eventId) });
  if (!ev || ev.communityId !== communityId) return c.json({ error: "Event not found" }, 404);
  
  const [updated] = await db.update(communityEvent).set({
    title, description, date, time, location, link, imageUrl, updatedAt: new Date()
  }).where(eq(communityEvent.id, eventId)).returning();
  
  return c.json(updated);
});

app.delete("/:id/events/:eventId", async (c) => {
  const communityId = c.req.param("id");
  const eventId = c.req.param("eventId");
  const userId = c.get("userId");
  const db = getDb(c.env.DB);
  
  const mem = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
  });
  if (!mem || mem.role !== "ADMIN") {
    return c.json({ error: "Only admins can delete events" }, 403);
  }
  
  const ev = await db.query.communityEvent.findFirst({ where: eq(communityEvent.id, eventId) });
  if (!ev || ev.communityId !== communityId) return c.json({ error: "Event not found" }, 404);
  
  await db.delete(communityEvent).where(eq(communityEvent.id, eventId));
  return c.json({ message: "Event deleted successfully" });
});

app.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const ev = await db.query.communityEvent.findFirst({
    where: eq(communityEvent.id, id),
    with: { attendees: true }
  });
  if (!ev) return c.json({ error: "Event not found" }, 404);
  return c.json(ev);
});

app.post("/events/:id/attend", async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("id");
  const db = getDb(c.env.DB);
  
  const existing = await db.query.eventAttendee.findFirst({ where: and(eq(eventAttendee.eventId, eventId), eq(eventAttendee.userId, userId)) });
  if (existing) {
    return c.json({ message: "Already attending" });
  }
  
  const [att] = await db.insert(eventAttendee).values({
    id: crypto.randomUUID(),
    eventId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  return c.json({ message: "Attending event", attendee: att });
});

app.post("/events/:id/unattend", async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("id");
  const db = getDb(c.env.DB);
  
  const existing = await db.query.eventAttendee.findFirst({ where: and(eq(eventAttendee.eventId, eventId), eq(eventAttendee.userId, userId)) });
  if (!existing) {
    return c.json({ error: "Not attending" }, 400);
  }
  
  await db.delete(eventAttendee).where(eq(eventAttendee.id, existing.id));
  return c.json({ message: "Unattended event successfully" });
});

app.get("/events/:id/attendees", async (c) => {
  const eventId = c.req.param("id");
  const db = getDb(c.env.DB);
  
  const list = await db.query.eventAttendee.findMany({
    where: eq(eventAttendee.eventId, eventId),
    with: { user: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } }
  });
  return c.json(list.map(a => a.user));
});

export default app;
`;
fs.writeFileSync('src/routes/communities/events.ts', code);
console.log('Migrated events.ts to Drizzle!');
