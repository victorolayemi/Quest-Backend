
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc } from 'drizzle-orm';
import { 
  bibleReadingHistory, 
  bibleHighlight, 
  bibleBookmark, 
  bibleNote 
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

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
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const reference = `${bookId.toUpperCase()} ${chapterId}`;
  
  await db.insert(bibleReadingHistory).values({
    id: crypto.randomUUID(),
    userId,
    verseRef: reference
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
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const verseRef = body.reference || body.verseRef;
  const color = body.color;
  const db = getDrizzle(c.env.DB);
  
  const [highlight] = await db.insert(bibleHighlight).values({
    id: crypto.randomUUID(),
    userId,
    verseRef,
    color
  }).returning();
  
  return c.json(highlight);
});

bible.get("/highlights", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  
  const list = await db.query.bibleHighlight.findMany({
    where: eq(bibleHighlight.userId, userId),
    offset: skip2,
    limit: limit
  });
  
  return c.json(list);
});

bible.delete("/highlights/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.bibleHighlight.findFirst({ where: eq(bibleHighlight.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Highlight not found" }, 404);
  
  await db.delete(bibleHighlight).where(eq(bibleHighlight.id, id));
  return c.json({ message: "Highlight removed successfully" });
});

bible.post("/bookmarks", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const verseRef = body.reference || body.verseRef;
  const db = getDrizzle(c.env.DB);
  
  const [bookmark] = await db.insert(bibleBookmark).values({
    id: crypto.randomUUID(),
    userId,
    verseRef
  }).returning();
  
  return c.json(bookmark);
});

bible.get("/bookmarks", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  
  const list = await db.query.bibleBookmark.findMany({
    where: eq(bibleBookmark.userId, userId),
    offset: skip2,
    limit: limit
  });
  
  return c.json(list);
});

bible.delete("/bookmarks/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.bibleBookmark.findFirst({ where: eq(bibleBookmark.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Bookmark not found" }, 404);
  
  await db.delete(bibleBookmark).where(eq(bibleBookmark.id, id));
  
  return c.json({ message: "Bookmark removed successfully" });
});

bible.post("/notes", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const verseRef = body.reference || body.verseRef;
  const noteText = body.note || body.noteText;
  const db = getDrizzle(c.env.DB);
  
  const [note] = await db.insert(bibleNote).values({
    id: crypto.randomUUID(),
    userId,
    verseRef,
    noteText
  }).returning();
  
  return c.json(note);
});

bible.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.bibleReadingHistory.findMany({
    where: eq(bibleReadingHistory.userId, userId),
    orderBy: [desc(bibleReadingHistory.readAt)],
    limit: 20
  });
  
  return c.json(list);
});

export default bible;
