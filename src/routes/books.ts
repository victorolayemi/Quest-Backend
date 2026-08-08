
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc, sql, or, like, and } from 'drizzle-orm';
import { 
  book, 
  user, 
  savedBook, 
  bookComment, 
  bookReaction,
  bookLike
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

import { Bindings, Variables } from '../types';
var books = new Hono<{Bindings: Bindings, Variables: Variables}>();
books.use("*", authMiddleware);

books.get("/", async (c) => {
  const db = getDrizzle(c.env.DB);
  const allBooksData = await db.query.book.findMany({
    where: eq(book.status, "APPROVED"),
    orderBy: [desc(book.createdAt)],
  });

  const formatted = await Promise.all(allBooksData.map(async (b) => {
    const [rc] = await db.select({ count: sql<number>`count(*)` }).from(bookReaction).where(eq(bookReaction.bookId, b.id));
    const [cc] = await db.select({ count: sql<number>`count(*)` }).from(bookComment).where(eq(bookComment.bookId, b.id));
    return {
      ...b,
      _count: {
        reactions: Number(rc.count),
        comments: Number(cc.count)
      }
    };
  }));

  return c.json(formatted);
});

books.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const userObj = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!userObj || (userObj.verificationBadge !== "GOLD" && !userObj.isAdmin)) {
    return c.json({ error: "Only Gold badge members can submit books." }, 403);
  }

  let title, author, description, topic, downloadUrl, imageUrl;

  try {
    const formData = await c.req.formData();
    title = (formData.get("title") as string) || "Untitled";
    author = (formData.get("author") as string) || "Unknown";
    description = (formData.get("description") as string) || "";
    topic = (formData.get("topic") as string) || "General";
    
    const file = formData.get("file");
    if (file && (file as File).size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `uploads/books-${Date.now()}-${(file as File).name}`;
      const fileBuffer = await (file as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
      const origin = new URL(c.req.url).origin;
      downloadUrl = `${origin}/api/v1/media/download/${fileKey}`;
    }

    const thumbnail = formData.get("thumbnail");
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/books-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      const origin = new URL(c.req.url).origin;
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    }
  } catch (e) {
    const body = await c.req.json() as any;
    title = body.title;
    author = body.author || "Unknown";
    description = body.description || "";
    topic = body.topic || "General";
    downloadUrl = body.downloadUrl || "";
    imageUrl = body.imageUrl || "";
  }

  const [newBook] = await db.insert(book).values({
    id: crypto.randomUUID(),
    title,
    author,
    description,
    topic,
    downloadUrl: downloadUrl || "",
    imageUrl: imageUrl || "",
    authorId: userId,
    status: "PENDING_REVIEW"
  }).returning();
  
  return c.json({ message: "Book submitted for review successfully", book: newBook });
});

books.get("/saved", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const search = (c.req.query("search") ?? "").trim().toLowerCase();

  const skip = (page - 1) * limit;

  // Manual approach for pagination and search on relation
  // Since Drizzle's relational queries with findMany don't support root-level OR matching inside with nicely,
  // we can use standard select/joins.
  
  let baseQuery = db.select({
    savedBook: savedBook,
    book: book
  })
  .from(savedBook)
  .leftJoin(book, eq(savedBook.bookId, book.id))
  .where(eq(savedBook.userId, userId));
  
  if (search) {
    const searchPattern = `%${search}%`;
    baseQuery = db.select({
      savedBook: savedBook,
      book: book
    })
    .from(savedBook)
    .leftJoin(book, eq(savedBook.bookId, book.id))
    .where(
      and(
        eq(savedBook.userId, userId),
        or(
          like(book.title, searchPattern),
          like(book.author, searchPattern),
          like(book.description, searchPattern)
        )
      )
    );
  }

  const results = await baseQuery.orderBy(desc(savedBook.createdAt)).limit(limit).offset(skip);
  
  const totalResults = await db.select({ count: sql<number>`count(*)` })
    .from(savedBook)
    .leftJoin(book, eq(savedBook.bookId, book.id))
    .where(
      search 
      ? and(
          eq(savedBook.userId, userId),
          or(
            like(book.title, `%${search}%`),
            like(book.author, `%${search}%`),
            like(book.description, `%${search}%`)
          )
        )
      : eq(savedBook.userId, userId)
    );

  const total = totalResults[0].count;
  
  const mappedResults = results.map(r => ({
    ...r.savedBook,
    book: r.book
  }));

  return c.json({
    data: mappedResults,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});

books.get("/created", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  
  const myBooksData = await db.query.book.findMany({
    where: eq(book.authorId, userId),
    orderBy: [desc(book.createdAt)],
  });

  const formatted = await Promise.all(myBooksData.map(async (b) => {
    const [rc] = await db.select({ count: sql<number>`count(*)` }).from(bookReaction).where(eq(bookReaction.bookId, b.id));
    const [cc] = await db.select({ count: sql<number>`count(*)` }).from(bookComment).where(eq(bookComment.bookId, b.id));
    return {
      ...b,
      _count: {
        reactions: Number(rc.count),
        comments: Number(cc.count)
      }
    };
  }));

  return c.json(formatted);
});

books.get("/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  
  const bookObj = await db.query.book.findFirst({
    where: eq(book.id, bookId)
  });
  if (!bookObj) return c.json({ error: "Book not found" }, 404);
  
  const userId = c.get("userId") as string;
  const isSaved = await db.query.savedBook.findFirst({
    where: and(eq(savedBook.userId, userId), eq(savedBook.bookId, bookId))
  });
  const hasLiked = await db.query.bookLike.findFirst({
    where: and(eq(bookLike.userId, userId), eq(bookLike.bookId, bookId))
  });
  
  return c.json({ ...bookObj, isSaved: !!isSaved, hasLiked: !!hasLiked });
});

books.get("/:id/comments", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  
  const comments = await db.query.bookComment.findMany({
    where: eq(bookComment.bookId, bookId),
    with: {
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true
        }
      }
    },
    orderBy: [desc(bookComment.createdAt)]
  });
  return c.json(comments);
});

books.post("/:id/comments", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  if (!body.content) {
    return c.json({ error: "Content is required" }, 400);
  }
  
  const newCommentId = crypto.randomUUID();
  await db.insert(bookComment).values({
    id: newCommentId,
    content: body.content,
    bookId,
    userId
  });
  
  const comment = await db.query.bookComment.findFirst({
    where: eq(bookComment.id, newCommentId),
    with: {
      user: {
        columns: {
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
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  
  const reactions = await db.query.bookReaction.findMany({
    where: eq(bookReaction.bookId, bookId)
  });
  return c.json(reactions);
});

books.post("/:id/react", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const emoji = body.emoji || "\u{1F929}";
  
  const existingReaction = await db.query.bookReaction.findFirst({
    where: and(
      eq(bookReaction.bookId, bookId),
      eq(bookReaction.userId, userId),
      eq(bookReaction.emoji, emoji)
    )
  });
  
  if (existingReaction) {
    await db.delete(bookReaction).where(eq(bookReaction.id, existingReaction.id));
    return c.json({ message: "Reaction removed", added: false });
  } else {
    const [reaction] = await db.insert(bookReaction).values({
      id: crypto.randomUUID(),
      bookId,
      userId,
      emoji
    }).returning();
    return c.json({ message: "Reaction added", added: true, reaction }, 201);
  }
});

books.post("/:id/like", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId") as string;
  
  const existingLike = await db.query.bookLike.findFirst({
    where: and(
      eq(bookLike.bookId, bookId),
      eq(bookLike.userId, userId)
    )
  });
  
  const b = await db.query.book.findFirst({ where: eq(book.id, bookId) });
  if (!b) return c.json({ error: "Book not found" }, 404);
  
  if (existingLike) {
    await db.delete(bookLike).where(eq(bookLike.id, existingLike.id));
    await db.update(book).set({ likesCount: Math.max(0, b.likesCount - 1) }).where(eq(book.id, bookId));
    return c.json({ message: "Like removed", liked: false });
  } else {
    const [likeObj] = await db.insert(bookLike).values({
      id: crypto.randomUUID(),
      bookId,
      userId
    }).returning();
    await db.update(book).set({ likesCount: b.likesCount + 1 }).where(eq(book.id, bookId));
    return c.json({ message: "Like added", liked: true, like: likeObj }, 201);
  }
});

books.post("/:id/save", async (c) => {
  const db = getDrizzle(c.env.DB);
  const bookId = c.req.param("id");
  const userId = c.get("userId") as string;
  
  const existingSave = await db.query.savedBook.findFirst({
    where: and(eq(savedBook.userId, userId), eq(savedBook.bookId, bookId))
  });
  
  if (existingSave) {
    await db.delete(savedBook).where(eq(savedBook.id, existingSave.id));
    return c.json({ message: "Book unsaved", saved: false });
  } else {
    const [saved] = await db.insert(savedBook).values({
      id: crypto.randomUUID(),
      userId,
      bookId
    }).returning();
    return c.json({ message: "Book saved", saved: true, savedBook: saved }, 201);
  }
});

books.delete("/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  const bookId = c.req.param("id");

  const bookObj = await db.query.book.findFirst({ where: eq(book.id, bookId) });
  if (!bookObj) return c.json({ error: "Book not found" }, 404);
  if (bookObj.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(book).where(eq(book.id, bookId));
  return c.json({ message: "Book deleted successfully" });
});

books.put("/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get("userId") as string;
  const bookId = c.req.param("id");

  const existingBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
  if (!existingBook) return c.json({ error: "Book not found" }, 404);
  if (existingBook.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  let title, author, description, topic, downloadUrl, imageUrl;

  try {
    const formData = await c.req.formData();
    title = (formData.get("title") as string) || existingBook.title;
    author = (formData.get("author") as string) || existingBook.author;
    description = (formData.get("description") as string) || existingBook.description;
    topic = (formData.get("topic") as string) || existingBook.topic;

    const file = formData.get("file");
    if (file && (file as File).size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `uploads/books-${Date.now()}-${(file as File).name}`;
      const fileBuffer = await (file as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
      const origin = new URL(c.req.url).origin;
      downloadUrl = `${origin}/api/v1/media/download/${fileKey}`;
    } else {
      downloadUrl = existingBook.downloadUrl;
    }

    const thumbnail = formData.get("thumbnail");
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/books-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      const origin = new URL(c.req.url).origin;
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    } else {
      imageUrl = existingBook.imageUrl;
    }
  } catch (e) {
    const body = await c.req.json() as any;
    title = body.title !== undefined ? body.title : existingBook.title;
    author = body.author !== undefined ? body.author : existingBook.author;
    description = body.description !== undefined ? body.description : existingBook.description;
    topic = body.topic !== undefined ? body.topic : existingBook.topic;
    downloadUrl = body.downloadUrl !== undefined ? body.downloadUrl : existingBook.downloadUrl;
    imageUrl = body.imageUrl !== undefined ? body.imageUrl : existingBook.imageUrl;
  }

  if (existingBook.status === "APPROVED") {
    const [revision] = await db.insert(book).values({
      id: crypto.randomUUID(),
      title,
      author,
      description,
      topic,
      downloadUrl,
      imageUrl,
      authorId: userId,
      status: "PENDING_REVIEW",
      originalId: existingBook.id
    }).returning();
    return c.json({ message: "Book revision submitted for review", book: revision });
  } else {
    const [updatedBook] = await db.update(book).set({
      title,
      author,
      description,
      topic,
      downloadUrl,
      imageUrl,
      status: "PENDING_REVIEW"
    }).where(eq(book.id, bookId)).returning();
    return c.json({ message: "Book updated successfully", book: updatedBook });
  }
});

export default books;
