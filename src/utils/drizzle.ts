import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import * as relations from "../db/relations";

export function getDrizzle(db: any) {
  return drizzle(db, { schema: { ...schema, ...relations } });
}
