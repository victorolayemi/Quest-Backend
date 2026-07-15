import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { Bindings, Variables } from '../types';

const notesRouter = new Hono<{Bindings: Bindings, Variables: Variables}>();
notesRouter.use("*", authMiddleware);
notesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  const list = await prisma.personalNote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: skip2,
    take: limit
  });
  const formatted = list.map((n: any) => ({
    ...n,
    images: JSON.parse(n.images),
    verses: n.verses ? n.verses.split(",") : []
  }));
  return c.json(formatted);
});
notesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const note = await prisma.personalNote.findUnique({
    where: { id }
  });
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  return c.json({
    ...note,
    images: JSON.parse(note.images),
    verses: note.verses ? note.verses.split(",") : []
  });
});
notesRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { title, bodyText, isFavorite, images, verses } = body;
  const prisma = getPrisma(c.env.DB);
  const newNote = await prisma.personalNote.create({
    data: {
      userId,
      title: title || "Untitled Note",
      bodyText: bodyText || "",
      isFavorite: isFavorite || false,
      images: JSON.stringify(images || []),
      verses: verses ? verses.join(",") : null
    }
  });
  return c.json({
    ...newNote,
    images: JSON.parse(newNote.images),
    verses: newNote.verses ? newNote.verses.split(",") : []
  });
});
notesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const { title, bodyText, isFavorite, images, verses } = body;
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.personalNote.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Note not found" }, 404);
  const updated = await prisma.personalNote.update({
    where: { id },
    data: {
      title: title || void 0,
      bodyText: bodyText || void 0,
      isFavorite: isFavorite !== void 0 ? isFavorite : void 0,
      images: images ? JSON.stringify(images) : void 0,
      verses: verses ? verses.join(",") : void 0
    }
  });
  return c.json({
    ...updated,
    images: JSON.parse(updated.images),
    verses: updated.verses ? updated.verses.split(",") : []
  });
});
notesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.personalNote.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Note not found" }, 404);
  await prisma.personalNote.delete({ where: { id } });
  return c.json({ message: "Note deleted successfully" });
});
notesRouter.post("/:id/favorite", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const note = await prisma.personalNote.findUnique({ where: { id } });
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  const updated = await prisma.personalNote.update({
    where: { id },
    data: { isFavorite: !note.isFavorite }
  });
  return c.json(updated);
});
notesRouter.post("/:id/images", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const { imageUrl } = body;
  const prisma = getPrisma(c.env.DB);
  const note = await prisma.personalNote.findUnique({ where: { id } });
  if (!note || note.userId !== userId) return c.json({ error: "Note not found" }, 404);
  const currentImages = JSON.parse(note.images);
  currentImages.push(imageUrl);
  const updated = await prisma.personalNote.update({
    where: { id },
    data: { images: JSON.stringify(currentImages) }
  });
  return c.json(updated);
});

export default notesRouter;
