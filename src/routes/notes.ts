
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc } from 'drizzle-orm';
import { personalNote } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { checkAndDeductCoinsDrizzle as checkAndDeductCoins } from '../utils/economy';
import { Bindings, Variables } from '../types';

const notesRouter = new Hono<{Bindings: Bindings, Variables: Variables}>();
notesRouter.use("*", authMiddleware);

notesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  
  const list = await db.query.personalNote.findMany({
    where: eq(personalNote.userId, userId as string),
    orderBy: [desc(personalNote.createdAt)],
    offset: skip2,
    limit: limit
  });
  
  const formatted = list.map((n: any) => ({
    ...n,
    isFavorite: !!n.isFavorite,
    images: JSON.parse(n.images || '[]'),
    verses: n.verses ? n.verses.split(",") : []
  }));
  
  return c.json(formatted);
});

notesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const note = await db.query.personalNote.findFirst({
    where: eq(personalNote.id, id)
  });
  
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  
  return c.json({
    ...note,
    isFavorite: !!note.isFavorite,
    images: JSON.parse(note.images || '[]'),
    verses: note.verses ? note.verses.split(",") : []
  });
});

notesRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, bodyText, isFavorite, images, verses } = body;
  const db = getDrizzle(c.env.DB);

  const economyCheck = await checkAndDeductCoins(c, db, userId as string, 'create_note', 'Created a new note');
  if (!economyCheck.success) {
    return c.json({ error: economyCheck.message || "Insufficient coins or limit reached" }, 403);
  }

  const [newNote] = await db.insert(personalNote).values({
    id: crypto.randomUUID(),
    userId: userId as string,
    title: title || "Untitled Note",
    bodyText: bodyText || "",
    isFavorite: !!isFavorite,
    images: JSON.stringify(images || []),
    verses: verses ? verses.join(",") : null
  }).returning();
  
  return c.json({
    ...newNote,
    isFavorite: !!newNote.isFavorite,
    images: JSON.parse(newNote.images || '[]'),
    verses: newNote.verses ? newNote.verses.split(",") : []
  });
});

notesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, bodyText, isFavorite, images, verses } = body;
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.personalNote.findFirst({ where: eq(personalNote.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Note not found" }, 404);
  
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (bodyText !== undefined) updateData.bodyText = bodyText;
  if (isFavorite !== undefined) updateData.isFavorite = !!isFavorite;
  if (images !== undefined) updateData.images = JSON.stringify(images);
  if (verses !== undefined) updateData.verses = verses ? verses.join(",") : null;
  
  const [updated] = await db.update(personalNote)
    .set(updateData)
    .where(eq(personalNote.id, id))
    .returning();
    
  return c.json({
    ...updated,
    isFavorite: !!updated.isFavorite,
    images: JSON.parse(updated.images || '[]'),
    verses: updated.verses ? updated.verses.split(",") : []
  });
});

notesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.personalNote.findFirst({ where: eq(personalNote.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Note not found" }, 404);
  
  await db.delete(personalNote).where(eq(personalNote.id, id));
  
  return c.json({ message: "Note deleted successfully" });
});

notesRouter.post("/:id/favorite", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const note = await db.query.personalNote.findFirst({ where: eq(personalNote.id, id) });
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  
  const newFav = !note.isFavorite;
  
  const [updated] = await db.update(personalNote)
    .set({ isFavorite: newFav })
    .where(eq(personalNote.id, id))
    .returning();
    
  return c.json({
    ...updated,
    isFavorite: !!updated.isFavorite
  });
});

notesRouter.post("/:id/images", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { imageUrl } = body;
  const db = getDrizzle(c.env.DB);
  
  const note = await db.query.personalNote.findFirst({ where: eq(personalNote.id, id) });
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  
  const currentImages = JSON.parse(note.images || '[]');
  currentImages.push(imageUrl);
  
  const [updated] = await db.update(personalNote)
    .set({ images: JSON.stringify(currentImages) })
    .where(eq(personalNote.id, id))
    .returning();
    
  return c.json({
    ...updated,
    images: JSON.parse(updated.images || '[]')
  });
});

export default notesRouter;
