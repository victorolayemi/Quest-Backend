
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and, sql, desc, inArray } from 'drizzle-orm';
import { journalEntry } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

import { Bindings, Variables } from '../types';
import { checkAndDeductCoinsDrizzle as checkAndDeductCoins } from '../utils/economy';

var journals = new Hono<{Bindings: Bindings, Variables: Variables}>();
journals.use("*", authMiddleware);

journals.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  
  const list = await db.query.journalEntry.findMany({
    where: eq(journalEntry.userId, userId as string),
    orderBy: [desc(journalEntry.createdAt)],
    offset: skip2,
    limit: limit
  });
  
  const formatted = list.map((j: any) => ({
    ...j,
    feelings: JSON.parse(j.feelings || '[]'),
    verses: j.verses ? j.verses.split(",") : []
  }));
  
  return c.json(formatted);
});

journals.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const journal = await db.query.journalEntry.findFirst({
    where: eq(journalEntry.id, id)
  });
  
  if (!journal || journal.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  
  return c.json({
    ...journal,
    feelings: JSON.parse(journal.feelings || '[]'),
    verses: journal.verses ? journal.verses.split(",") : []
  });
});

journals.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, bodyText, feelings, verses } = body;
  const db = getDrizzle(c.env.DB);

  const economyCheck = await checkAndDeductCoins(c, db, userId as string, 'create_journal', 'Created a new journal entry');
  if (!economyCheck.success) {
    return c.json({ error: economyCheck.message || "Insufficient coins or limit reached" }, 403);
  }

  const [newJournal] = await db.insert(journalEntry).values({
    id: crypto.randomUUID(),
    userId: userId as string,
    title: title || "Untitled Journal",
    bodyText: bodyText || "",
    feelings: JSON.stringify(feelings || []),
    verses: verses ? verses.join(",") : null
  }).returning();
  
  return c.json({
    ...newJournal,
    feelings: JSON.parse(newJournal.feelings || '[]'),
    verses: newJournal.verses ? newJournal.verses.split(",") : []
  });
});

journals.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, bodyText, feelings, verses } = body;
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (bodyText !== undefined) updateData.bodyText = bodyText;
  if (feelings !== undefined) updateData.feelings = JSON.stringify(feelings);
  if (verses !== undefined) updateData.verses = verses ? verses.join(",") : null;
  
  const [updated] = await db.update(journalEntry)
    .set(updateData)
    .where(eq(journalEntry.id, id))
    .returning();
    
  return c.json({
    ...updated,
    feelings: JSON.parse(updated.feelings || '[]'),
    verses: updated.verses ? updated.verses.split(",") : []
  });
});

journals.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, id) });
  if (!existing || existing.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  
  await db.delete(journalEntry).where(eq(journalEntry.id, id));
  
  return c.json({ message: "Journal deleted successfully" });
});

journals.post("/:id/verses", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { verseRef } = body;
  const db = getDrizzle(c.env.DB);
  
  const journal = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, id) });
  if (!journal || journal.userId !== userId) return c.json({ error: "Journal not found" }, 404);
  
  const currentVerses = journal.verses ? journal.verses.split(",") : [];
  if (!currentVerses.includes(verseRef)) {
    currentVerses.push(verseRef);
  }
  
  const [updated] = await db.update(journalEntry)
    .set({ verses: currentVerses.join(",") })
    .where(eq(journalEntry.id, id))
    .returning();
    
  return c.json(updated);
});

journals.post("/:id/merge", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { mergeIds } = body;
  const db = getDrizzle(c.env.DB);
  
  const mainJournal = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, id) });
  if (!mainJournal || mainJournal.userId !== userId) return c.json({ error: "Main journal not found" }, 404);
  
  const otherJournals = await db.query.journalEntry.findMany({
    where: and(inArray(journalEntry.id, mergeIds), eq(journalEntry.userId, userId as string))
  });
  
  let mergedBody = mainJournal.bodyText;
  const mergedFeelings = new Set(JSON.parse(mainJournal.feelings || '[]'));
  const mergedVerses = new Set(mainJournal.verses ? mainJournal.verses.split(",") : []);
  
  otherJournals.forEach((j: any) => {
    mergedBody += `\n\n--- Merged from [${j.title}] ---\n${j.bodyText}`;
    const otherFeelings = JSON.parse(j.feelings || '[]');
    otherFeelings.forEach((f: any) => mergedFeelings.add(f));
    if (j.verses) {
      j.verses.split(",").forEach((v: any) => mergedVerses.add(v));
    }
  });
  
  const [updated] = await db.update(journalEntry).set({
    bodyText: mergedBody,
    feelings: JSON.stringify(Array.from(mergedFeelings)),
    verses: Array.from(mergedVerses).join(",")
  }).where(eq(journalEntry.id, id)).returning();
  
  if (mergeIds.length > 0) {
    await db.delete(journalEntry).where(inArray(journalEntry.id, mergeIds));
  }
  
  return c.json(updated);
});

journals.get("/notes", async (c) => {
  return c.json({ message: "Use /api/v1/notes endpoint" });
});

export default journals;
