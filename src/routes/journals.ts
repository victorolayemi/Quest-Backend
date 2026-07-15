import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/journals.ts
import { Bindings, Variables } from '../types';
var journals = new Hono<{Bindings: Bindings, Variables: Variables}>();
journals.use("*", authMiddleware);
journals.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const skip2 = (page - 1) * limit;
  const list = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: skip2,
    take: limit
  });
  const formatted = list.map((j: any) => ({
    ...j,
    feelings: JSON.parse(j.feelings),
    verses: j.verses ? j.verses.split(",") : []
  }));
  return c.json(formatted);
});
journals.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const journal = await prisma.journalEntry.findUnique({
    where: { id }
  });
  if (!journal || journal.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  return c.json({
    ...journal,
    feelings: JSON.parse(journal.feelings),
    verses: journal.verses ? journal.verses.split(",") : []
  });
});
journals.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { title, bodyText, feelings, verses } = body;
  const prisma = getPrisma(c.env.DB);
  const newJournal = await prisma.journalEntry.create({
    data: {
      userId,
      title: title || "Untitled Journal",
      bodyText: bodyText || "",
      feelings: JSON.stringify(feelings || []),
      verses: verses ? verses.join(",") : null
    }
  });
  return c.json({
    ...newJournal,
    feelings: JSON.parse(newJournal.feelings),
    verses: newJournal.verses ? newJournal.verses.split(",") : []
  });
});
journals.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const { title, bodyText, feelings, verses } = body;
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  const updated = await prisma.journalEntry.update({
    where: { id },
    data: {
      title: title || void 0,
      bodyText: bodyText || void 0,
      feelings: feelings ? JSON.stringify(feelings) : void 0,
      verses: verses ? verses.join(",") : void 0
    }
  });
  return c.json({
    ...updated,
    feelings: JSON.parse(updated.feelings),
    verses: updated.verses ? updated.verses.split(",") : []
  });
});
journals.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return c.json({ error: "Journal entry not found" }, 404);
  await prisma.journalEntry.delete({ where: { id } });
  return c.json({ message: "Journal deleted successfully" });
});
journals.post("/:id/verses", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const { verseRef } = body;
  const prisma = getPrisma(c.env.DB);
  const journal = await prisma.journalEntry.findUnique({ where: { id } });
  if (!journal || journal.userId !== userId) return c.json({ error: "Journal not found" }, 404);
  const currentVerses = journal.verses ? journal.verses.split(",") : [];
  if (!currentVerses.includes(verseRef)) {
    currentVerses.push(verseRef);
  }
  const updated = await prisma.journalEntry.update({
    where: { id },
    data: { verses: currentVerses.join(",") }
  });
  return c.json(updated);
});
journals.post("/:id/merge", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const { mergeIds } = body;
  const prisma = getPrisma(c.env.DB);
  const mainJournal = await prisma.journalEntry.findUnique({ where: { id } });
  if (!mainJournal || mainJournal.userId !== userId) return c.json({ error: "Main journal not found" }, 404);
  const otherJournals = await prisma.journalEntry.findMany({
    where: { id: { in: mergeIds }, userId }
  });
  let mergedBody = mainJournal.bodyText;
  const mergedFeelings = new Set(JSON.parse(mainJournal.feelings));
  const mergedVerses = new Set(mainJournal.verses ? mainJournal.verses.split(",") : []);
  otherJournals.forEach((j: any) => {
    mergedBody += `

--- Merged from [${j.title}] ---
${j.bodyText}`;
    const otherFeelings = JSON.parse(j.feelings);
    otherFeelings.forEach((f: any) => mergedFeelings.add(f));
    if (j.verses) {
      j.verses.split(",").forEach((v: any) => mergedVerses.add(v));
    }
  });
  const updated = await prisma.journalEntry.update({
    where: { id },
    data: {
      bodyText: mergedBody,
      feelings: JSON.stringify(Array.from(mergedFeelings)),
      verses: Array.from(mergedVerses).join(",")
    }
  });
  await prisma.journalEntry.deleteMany({
    where: { id: { in: mergeIds } }
  });
  return c.json(updated);
});
journals.get("/notes", async (c) => {
  return c.json({ message: "Use /api/v1/notes endpoint" });
});
export default journals;
