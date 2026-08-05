import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/books.ts
import { Bindings, Variables } from '../types';
var books = new Hono<{Bindings: Bindings, Variables: Variables}>();
books.use("*", authMiddleware);
books.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const allBooks = await prisma.book.findMany({
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { reactions: true, comments: true }
      }
    }
  });
  return c.json(allBooks);
});

books.post("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  
  // Only Gold Badge users can upload books
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.verificationBadge !== "GOLD" && !user.isAdmin)) {
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
    const body = await c.req.json();
    title = body.title;
    author = body.author || "Unknown";
    description = body.description || "";
    topic = body.topic || "General";
    downloadUrl = body.downloadUrl || "";
    imageUrl = body.imageUrl || "";
  }

  const book = await prisma.book.create({ 
    data: {
      title,
      author,
      description,
      topic,
      downloadUrl: downloadUrl || "",
      imageUrl: imageUrl || "",
      authorId: userId,
      status: "PENDING_REVIEW"
    } 
  });
  
  return c.json({ message: "Book submitted for review successfully", book });
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
books.get("/created", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const myBooks = await prisma.book.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { reactions: true, comments: true } }
    }
  });
  return c.json(myBooks);
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


books.delete("/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const bookId = c.req.param("id");

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return c.json({ error: "Book not found" }, 404);
  if (book.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await prisma.book.delete({ where: { id: bookId } });
  return c.json({ message: "Book deleted successfully" });
});

books.put("/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const bookId = c.req.param("id");

  const existingBook = await prisma.book.findUnique({ where: { id: bookId } });
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
    const body = await c.req.json();
    title = body.title !== undefined ? body.title : existingBook.title;
    author = body.author !== undefined ? body.author : existingBook.author;
    description = body.description !== undefined ? body.description : existingBook.description;
    topic = body.topic !== undefined ? body.topic : existingBook.topic;
    downloadUrl = body.downloadUrl !== undefined ? body.downloadUrl : existingBook.downloadUrl;
    imageUrl = body.imageUrl !== undefined ? body.imageUrl : existingBook.imageUrl;
  }

  // Duplicate as pending if previously approved
  if (existingBook.status === "APPROVED") {
    const revision = await prisma.book.create({
      data: {
        title,
        author,
        description,
        topic,
        downloadUrl,
        imageUrl,
        authorId: userId,
        status: "PENDING_REVIEW",
        originalId: existingBook.id
      }
    });
    return c.json({ message: "Book revision submitted for review", book: revision });
  } else {
    // If it's already pending/rejected, just update in place
    const updatedBook = await prisma.book.update({
      where: { id: bookId },
      data: {
        title,
        author,
        description,
        topic,
        downloadUrl,
        imageUrl,
        status: "PENDING_REVIEW"
      }
    });
    return c.json({ message: "Book updated successfully", book: updatedBook });
  }
});

export default books;
