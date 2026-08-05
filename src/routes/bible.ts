import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/bible.ts
import { Bindings, Variables } from '../types';
var bible = new Hono<{Bindings: Bindings, Variables: Variables}>();
bible.use("*", authMiddleware);
var bibleBooks = [
  { id: "genesis", name: "Genesis", chapters: 50 },
  { id: "exodus", name: "Exodus", chapters: 40 },
  { id: "john", name: "John", chapters: 21 },
  { id: "romans", name: "Romans", chapters: 16 }
];
bible.get("/books", async (c) => {
  return c.json(bibleBooks);
});
bible.get("/books/:bookId/chapters", async (c) => {
  const bookId = c.req.param("bookId");
  const book = bibleBooks.find((b) => b.id === bookId.toLowerCase());
  if (!book) return c.json({ error: "Book not found" }, 404);
  const chapters = Array.from({ length: book.chapters }, (_, i) => ({
    id: String(i + 1),
    chapterNumber: i + 1
  }));
  return c.json(chapters);
});
bible.get("/books/:bookId/chapters/:chapterId", async (c) => {
  const { bookId, chapterId } = c.req.param();
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const reference = `${bookId.toUpperCase()} ${chapterId}`;
  await prisma.bibleReadingHistory.create({
    data: { userId, verseRef: reference }
  });
  const verses = Array.from({ length: 5 }, (_, i) => ({
    verseNumber: i + 1,
    text: `This is verse ${i + 1} of ${reference} containing mock holy scripture for local development.`
  }));
  return c.json({
    reference,
    bookId,
    chapterId,
    verses
  });
});
bible.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const results = [
    { reference: "John 3:16", text: "For God so loved the world..." },
    { reference: "Romans 8:28", text: "And we know that all things work together for good..." }
  ].filter((v) => v.text.toLowerCase().includes(query.toLowerCase()));
  return c.json({
    query,
    results
  });
});
bible.get("/verse/:reference", async (c) => {
  const reference = c.req.param("reference");
  return c.json({
    reference,
    text: `Mock scripture content for ${reference}. "The truth will set you free."`
  });
});
bible.post("/highlights", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const verseRef = body.reference || body.verseRef;
  const color = body.color;
  const prisma = getPrisma(c.env.DB);
  const highlight = await prisma.bibleHighlight.create({
    data: { userId, verseRef, color }
  });
  return c.json(highlight);
});
bible.get("/highlights", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  const list = await prisma.bibleHighlight.findMany({
    where: { userId },
    skip: skip2,
    take: limit
  });
  return c.json(list);
});
bible.delete("/highlights/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.bibleHighlight.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Highlight not found" }, 404);
  await prisma.bibleHighlight.delete({ where: { id } });
  return c.json({ message: "Highlight removed successfully" });
});
bible.post("/bookmarks", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const verseRef = body.reference || body.verseRef;
  const prisma = getPrisma(c.env.DB);
  const bookmark = await prisma.bibleBookmark.create({
    data: { userId, verseRef }
  });
  return c.json(bookmark);
});
bible.get("/bookmarks", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  const list = await prisma.bibleBookmark.findMany({
    where: { userId },
    skip: skip2,
    take: limit
  });
  return c.json(list);
});
bible.delete("/bookmarks/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.bibleBookmark.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Bookmark not found" }, 404);
  await prisma.bibleBookmark.delete({ where: { id } });
  return c.json({ message: "Bookmark removed successfully" });
});
bible.post("/notes", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const verseRef = body.reference || body.verseRef;
  const noteText = body.note || body.noteText;
  const prisma = getPrisma(c.env.DB);
  const note = await prisma.bibleNote.create({
    data: { userId, verseRef, noteText }
  });
  return c.json(note);
});
bible.get("/history", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.bibleReadingHistory.findMany({
    where: { userId },
    orderBy: { readAt: "desc" },
    take: 20
  });
  return c.json(list);
});


export default bible;
