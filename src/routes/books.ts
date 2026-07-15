import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/books.ts
import { Bindings, Variables } from '../types';
var books = new Hono<{Bindings: Bindings, Variables: Variables}>();
books.use("*", authMiddleware);
books.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const allBooks = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { reactions: true, comments: true }
      }
    }
  });
  return c.json(allBooks);
});
books.get("/saved", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const search = (c.req.query("search") ?? "").trim().toLowerCase();

  const where: any = { userId };

  if (search) {
    where.book = {
      OR: [
        { title: { contains: search } },
        { author: { contains: search } },
        { description: { contains: search } },
      ],
    };
  }

  const [savedBooks, total] = await Promise.all([
    prisma.savedBook.findMany({
      where,
      include: { book: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.savedBook.count({ where }),
  ]);

  return c.json({
    data: savedBooks,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
books.get("/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  });
  if (!book) return c.json({ error: "Book not found" }, 404);
  const userId = c.get("userId");
  const isSaved = await prisma.savedBook.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId
      }
    }
  });
  return c.json({ ...book, isSaved: !!isSaved });
});
books.get("/:id/comments", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const comments = await prisma.bookComment.findMany({
    where: { bookId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json(comments);
});
books.post("/:id/comments", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.content) {
    return c.json({ error: "Content is required" }, 400);
  }
  const comment = await prisma.bookComment.create({
    data: {
      content: body.content,
      bookId,
      userId
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  });
  return c.json(comment, 201);
});
books.get("/:id/reactions", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const reactions = await prisma.bookReaction.findMany({
    where: { bookId }
  });
  return c.json(reactions);
});
books.post("/:id/react", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json();
  const emoji = body.emoji || "\u{1F929}";
  const existingReaction = await prisma.bookReaction.findUnique({
    where: {
      bookId_userId_emoji: {
        bookId,
        userId,
        emoji
      }
    }
  });
  if (existingReaction) {
    await prisma.bookReaction.delete({
      where: { id: existingReaction.id }
    });
    return c.json({ message: "Reaction removed", added: false });
  } else {
    const reaction = await prisma.bookReaction.create({
      data: {
        bookId,
        userId,
        emoji
      }
    });
    return c.json({ message: "Reaction added", added: true, reaction }, 201);
  }
});
books.post("/:id/save", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId");
  const existingSave = await prisma.savedBook.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId
      }
    }
  });
  if (existingSave) {
    await prisma.savedBook.delete({
      where: { id: existingSave.id }
    });
    return c.json({ message: "Book unsaved", saved: false });
  } else {
    const savedBook = await prisma.savedBook.create({
      data: {
        userId,
        bookId
      }
    });
    return c.json({ message: "Book saved", saved: true, savedBook }, 201);
  }
});


export default books;
