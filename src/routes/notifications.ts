import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/notifications.ts
import { Bindings, Variables } from '../types';
var notifications = new Hono<{Bindings: Bindings, Variables: Variables}>();
notifications.use("*", authMiddleware);
async function seedNotificationIfEmpty(prisma: any, userId: string) {
  const count = await prisma.notification.count({ where: { userId } });
  if (count === 0) {
    await prisma.notification.create({
      data: {
        userId,
        title: "Welcome to Quest! \u{1F31F}",
        message: "Get ready to study the word, challenge your friends, and build daily habits.",
        isRead: false
      }
    });
  }
}
notifications.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  await seedNotificationIfEmpty(prisma, userId);
  const list = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return c.json(list);
});
notifications.post("/read", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  return c.json({ message: "All notifications marked as read" });
});
notifications.post("/:id/read", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Notification not found" }, 404);
  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });
  return c.json(updated);
});
notifications.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Notification not found" }, 404);
  await prisma.notification.delete({ where: { id } });
  return c.json({ message: "Notification deleted successfully" });
});


export default notifications;
