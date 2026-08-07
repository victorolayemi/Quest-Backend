import re

with open("src/routes/contentAdmin.ts", "r") as f:
    code = f.read()

# Replace imports
code = code.replace("import { getPrisma } from '../utils/prisma';", 
    "import { getDrizzle } from '../db/drizzle';\nimport { eq, desc, inArray, sql } from 'drizzle-orm';\nimport { devotionPlan, book, devotionDay, dailyBread, affirmation, sermonMedia, userMedia } from '../db/schema';")
code = code.replace("getPrisma(c.env.DB)", "getDrizzle(c.env.DB)")
code = code.replace("const prisma = getDrizzle(c.env.DB);", "const db = getDrizzle(c.env.DB);")

# contentAdmin.get("/approvals/pending", async (c) => {
code = code.replace("prisma.devotionPlan.findMany({\n    where: { status: \"PENDING_REVIEW\" },\n    include: { authorUser: { select: { username: true, email: true, firstName: true, lastName: true } } },\n    orderBy: { createdAt: \"desc\" }\n  });",
"""db.query.devotionPlan.findMany({
    where: eq(devotionPlan.status, "PENDING_REVIEW"),
    with: { user: { columns: { username: true, email: true, firstName: true, lastName: true } } },
    orderBy: [desc(devotionPlan.createdAt)]
  });""")
code = code.replace("prisma.book.findMany({\n    where: { status: \"PENDING_REVIEW\" },\n    include: { authorUser: { select: { username: true, email: true, firstName: true, lastName: true } } },\n    orderBy: { createdAt: \"desc\" }\n  });",
"""db.query.book.findMany({
    where: eq(book.status, "PENDING_REVIEW"),
    with: { user: { columns: { username: true, email: true, firstName: true, lastName: true } } },
    orderBy: [desc(book.createdAt)]
  });""")

code = code.replace("d.authorUser ?", "d.user ?")
code = code.replace("d.authorUser.", "d.user.")
code = code.replace("b.authorUser ?", "b.user ?")
code = code.replace("b.authorUser.", "b.user.")

# contentAdmin.post("/approvals/:type/:id", async (c) => {
code = code.replace("""const updated = await prisma.devotionPlan.update({
      where: { id },
      data: { status: newStatus }
    });
    return c.json({ success: true, status: updated.status });""",
"""const [updated] = await db.update(devotionPlan).set({ status: newStatus }).where(eq(devotionPlan.id, id)).returning();
    return c.json({ success: true, status: updated.status });""")
code = code.replace("""const updated = await prisma.book.update({
      where: { id },
      data: { status: newStatus }
    });
    return c.json({ success: true, status: updated.status });""",
"""const [updated] = await db.update(book).set({ status: newStatus }).where(eq(book.id, id)).returning();
    return c.json({ success: true, status: updated.status });""")

# contentAdmin.get("/devotions/plans", async (c) => {
code = code.replace("""const plans = await prisma.devotionPlan.findMany({
    include: { _count: { select: { days: true } } }
  });
  return c.json({ plans });""",
"""const plans = await db.query.devotionPlan.findMany({
    extras: {
      _count_days: sql<number>`(SELECT count(*) FROM ${devotionDay} WHERE ${devotionDay.planId} = ${devotionPlan.id})`.as('_count_days')
    }
  });
  const mapped = plans.map((p: any) => {
    const { _count_days, ...rest } = p;
    return { ...rest, _count: { days: _count_days } };
  });
  return c.json({ plans: mapped });""")

# contentAdmin.post("/devotions/plans", async (c) => {
code = code.replace("""const plan = await prisma.devotionPlan.create({ data });""",
"""const [plan] = await db.insert(devotionPlan).values(data).returning();""")

# contentAdmin.delete("/devotions/plans/:id", async (c) => {
code = code.replace("""await prisma.devotionPlan.delete({ where: { id: c.req.param("id") } });""",
"""await db.delete(devotionPlan).where(eq(devotionPlan.id, c.req.param("id") as string));""")

# contentAdmin.put("/devotions/plans/:id", async (c) => {
code = code.replace("""const plan = await prisma.devotionPlan.update({
    where: { id: c.req.param("id") },
    data: updateData
  });""",
"""const [plan] = await db.update(devotionPlan).set(updateData).where(eq(devotionPlan.id, c.req.param("id") as string)).returning();""")

# contentAdmin.get("/devotions/plans/:planId/days", async (c) => {
code = code.replace("""const days = await prisma.devotionDay.findMany({
    where: { planId: c.req.param("planId") },
    orderBy: { dayNumber: "asc" }
  });""",
"""const days = await db.query.devotionDay.findMany({
    where: eq(devotionDay.planId, c.req.param("planId") as string),
    orderBy: (d, { asc }) => [asc(d.dayNumber)]
  });""")

# contentAdmin.post("/devotions/days", async (c) => {
code = code.replace("""const day2 = await prisma.devotionDay.create({ data: body });""",
"""const [day2] = await db.insert(devotionDay).values(body).returning();""")

# contentAdmin.delete("/devotions/days/:id", async (c) => {
code = code.replace("""await prisma.devotionDay.delete({ where: { id: c.req.param("id") } });""",
"""await db.delete(devotionDay).where(eq(devotionDay.id, c.req.param("id") as string));""")

# contentAdmin.put("/devotions/days/:id", async (c) => {
code = code.replace("""const day2 = await prisma.devotionDay.update({
    where: { id: c.req.param("id") },
    data: body
  });""",
"""const [day2] = await db.update(devotionDay).set(body).where(eq(devotionDay.id, c.req.param("id") as string)).returning();""")

# contentAdmin.post("/devotions/bulk-import", async (c) => {
code = code.replace("""const plan = await prisma.devotionPlan.create({
      data: {
        ...planData,
        days: {
          create: days
        }
      }
    });
    createdPlans.push(plan);""",
"""const [plan] = await db.insert(devotionPlan).values(planData).returning();
    if (days && days.length > 0) {
      const daysToInsert = days.map((d: any) => ({ ...d, planId: plan.id }));
      await db.insert(devotionDay).values(daysToInsert);
    }
    createdPlans.push(plan);""")

# contentAdmin.get("/daily-bread", async (c) => {
code = code.replace("""const breads = await prisma.dailyBread.findMany({ orderBy: { date: "desc" } });""",
"""const breads = await db.query.dailyBread.findMany({ orderBy: [desc(dailyBread.date)] });""")

# contentAdmin.post("/daily-bread", async (c) => {
code = code.replace("""const bread = await prisma.dailyBread.create({ data: body });""",
"""const [bread] = await db.insert(dailyBread).values(body).returning();""")

# contentAdmin.delete("/daily-bread/:id", async (c) => {
code = code.replace("""await prisma.dailyBread.delete({ where: { id: c.req.param("id") } });""",
"""await db.delete(dailyBread).where(eq(dailyBread.id, c.req.param("id") as string));""")

# contentAdmin.get("/affirmations", async (c) => {
code = code.replace("""const affirmations = await prisma.affirmation.findMany({ orderBy: { createdAt: "desc" } });""",
"""const affirmations = await db.query.affirmation.findMany({ orderBy: [desc(affirmation.createdAt)] });""")

# contentAdmin.post("/affirmations", async (c) => {
code = code.replace("""const affirmation = await prisma.affirmation.create({ data: body });""",
"""const [affirmation] = await db.insert(affirmation).values(body).returning();""")

# contentAdmin.delete("/affirmations/:id", async (c) => {
code = code.replace("""await prisma.affirmation.delete({ where: { id: c.req.param("id") } });""",
"""await db.delete(affirmation).where(eq(affirmation.id, c.req.param("id") as string));""")

# contentAdmin.get("/books", async (c) => {
code = code.replace("""const books2 = await prisma.book.findMany({ orderBy: { createdAt: "desc" } });""",
"""const books2 = await db.query.book.findMany({ orderBy: [desc(book.createdAt)] });""")

# contentAdmin.post("/books", async (c) => {
code = code.replace("""const book = await prisma.book.create({ 
    data: {
      title,
      author,
      description,
      topic,
      downloadUrl: downloadUrl || "",
      imageUrl: imageUrl || ""
    } 
  });""",
"""const [book] = await db.insert(book).values({
      title,
      author,
      description,
      topic,
      downloadUrl: downloadUrl || "",
      imageUrl: imageUrl || ""
  }).returning();""")

# contentAdmin.put("/books/:id", async (c) => {
code = code.replace("""const book = await prisma.book.update({ 
    where: { id },
    data: updateData
  });""",
"""const [bookRecord] = await db.update(book).set(updateData).where(eq(book.id, id as string)).returning();\n  const book = bookRecord;""")

# contentAdmin.delete("/books/:id", async (c) => {
code = code.replace("""await prisma.book.delete({ where: { id: c.req.param("id") } });""",
"""await db.delete(book).where(eq(book.id, c.req.param("id") as string));""")

# contentAdmin.get("/media", async (c) => {
code = code.replace("""const media2 = await prisma.sermonMedia.findMany({ orderBy: { createdAt: "desc" } });""",
"""const media2 = await db.query.sermonMedia.findMany({ orderBy: [desc(sermonMedia.createdAt)] });""")
code = code.replace("""const userMedia = await prisma.userMedia.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });""",
"""const userMedias = await db.query.userMedia.findMany({ with: { user: true }, orderBy: [desc(userMedia.createdAt)] });""")
code = code.replace("userMedia.map", "userMedias.map")

# contentAdmin.post("/media", async (c) => {
code = code.replace("""const media2 = await prisma.sermonMedia.create({ 
    data: {
      title,
      author,
      category,
      type,
      mediaUrl,
      imageUrl,
      duration
    }
  });""",
"""const [media2] = await db.insert(sermonMedia).values({
      title,
      author,
      category,
      type,
      mediaUrl,
      imageUrl,
      duration
  }).returning();""")

# contentAdmin.put("/media/:id", async (c) => {
code = code.replace("""const media2 = await prisma.sermonMedia.update({ 
      where: { id },
      data: updateData
    });""",
"""const [media2] = await db.update(sermonMedia).set(updateData).where(eq(sermonMedia.id, id as string)).returning();\nif (!media2) throw new Error('Not found');""")
code = code.replace("""const mediaUser = await prisma.userMedia.update({
        where: { id },
        data: {
          title: title !== undefined ? title : undefined,
          mediaUrl: mediaUrl !== undefined ? mediaUrl : undefined,
          imageUrl: imageUrl !== undefined ? imageUrl : undefined,
          type: type !== undefined ? type : undefined,
        }
      });""",
"""const updatePayload: any = {};
      if (title !== undefined) updatePayload.title = title;
      if (mediaUrl !== undefined) updatePayload.mediaUrl = mediaUrl;
      if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;
      if (type !== undefined) updatePayload.type = type;
      const [mediaUser] = await db.update(userMedia).set(updatePayload).where(eq(userMedia.id, id as string)).returning();\n      if (!mediaUser) throw new Error('Not found');""")

# contentAdmin.delete("/media/:id", async (c) => {
code = code.replace("""await prisma.sermonMedia.delete({ where: { id } });""",
"""await db.delete(sermonMedia).where(eq(sermonMedia.id, id as string));""")
code = code.replace("""await prisma.userMedia.delete({ where: { id } });""",
"""await db.delete(userMedia).where(eq(userMedia.id, id as string));""")

# Handle a book symbol shadowing issue: book import and book var name clash
code = code.replace("const [book] = await db.insert(book)", "const [bookResult] = await db.insert(book)")
code = code.replace("return c.json({ book });", "return c.json({ book: typeof book !== 'undefined' ? book : (typeof bookResult !== 'undefined' ? bookResult : (typeof bookRecord !== 'undefined' ? bookRecord : null)) });")

with open("src/routes/contentAdmin.ts", "w") as f:
    f.write(code)

