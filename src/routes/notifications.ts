import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { notification as notificationTable } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Bindings, Variables } from '../types';

var notifications = new Hono<{Bindings: Bindings, Variables: Variables}>();
notifications.use("*", authMiddleware);

async function seedNotificationIfEmpty(db: any, userId: string) {
  const countObj = await db.select({ count: sql<number>`count(*)` }).from(notificationTable).where(eq(notificationTable.userId, userId));
  const count = countObj[0].count;
  if (count === 0) {
    await db.insert(notificationTable).values({
      id: crypto.randomUUID(),
      userId,
      title: "Welcome to Quest! \u{1F31F}",
      message: "Get ready to study the word, challenge your friends, and build daily habits.",
      isRead: false
    });
  }
}

notifications.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  await seedNotificationIfEmpty(db, userId);
  const list = await db.query.notification.findMany({
    where: (n: any, { eq }: any) => eq(n.userId, userId),
    orderBy: (n: any, { desc }: any) => [desc(n.createdAt)]
  });
  return c.json(list);
});

notifications.post("/read", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  await db.update(notificationTable)
    .set({ isRead: true })
    .where(and(eq(notificationTable.userId, userId), eq(notificationTable.isRead, false)));
  return c.json({ message: "All notifications marked as read" });
});

notifications.post("/:id/read", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const existing = await db.query.notification.findFirst({ where: (n: any, { eq }: any) => eq(n.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Notification not found" }, 404);
  
  const updatedArr = await db.update(notificationTable)
    .set({ isRead: true })
    .where(eq(notificationTable.id, id))
    .returning();
  
  return c.json(updatedArr[0]);
});

notifications.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const existing = await db.query.notification.findFirst({ where: (n: any, { eq }: any) => eq(n.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Notification not found" }, 404);
  
  await db.delete(notificationTable).where(eq(notificationTable.id, id));
  return c.json({ message: "Notification deleted successfully" });
});

export default notifications;
