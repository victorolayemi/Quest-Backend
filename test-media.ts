import { getDrizzle } from "./src/utils/drizzle.js";
import { sermonMedia } from "./src/db/schema.js";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";

const sqlite = new Database("./prisma/dev.db");
const db = getDrizzle(sqlite as any);
async function run() {
  try {
    const sVideos = await db.query.sermonMedia.findMany({
      extras: {
        mediaLikesCount: sql<number>`(SELECT count(*) FROM "MediaLike" WHERE "MediaLike"."mediaId" = "SermonMedia"."id")`.as("mediaLikesCount")
      },
      limit: 1
    });
    console.log("Videos:", sVideos);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
