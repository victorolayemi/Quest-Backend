import { getDrizzle } from "./src/utils/drizzle.js";
import { community } from "./src/db/schema.js";
import Database from "better-sqlite3";

const sqlite = new Database("./prisma/dev.db");
sqlite.exec(`INSERT INTO Community (id, name, description, createdAt, updatedAt) VALUES ('test-id', 'test', 'test', '2024-05-12T12:00:00.000Z', '2024-05-12T12:00:00.000Z')`);

const db = getDrizzle(sqlite as any);
async function run() {
  const coms = sqlite.prepare("SELECT createdAt FROM Community").all();
  console.log("Raw SQLite:", coms);
  
  // Notice we don't use D1's db.query here because it's not compatible with better-sqlite3 in drizzle-orm/d1
}
run();
