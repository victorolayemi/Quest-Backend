import { getDrizzle } from "./src/utils/drizzle";
import { community, user } from "./src/db/schema";
import Database from "better-sqlite3";

const sqlite = new Database("./prisma/dev.db");
const db = getDrizzle(sqlite as any);
async function run() {
  const users = await db.select().from(user).limit(1);
  console.log("Users:", users);
  const coms = await db.select().from(community).limit(1);
  console.log("Communities:", coms);
}
run();
