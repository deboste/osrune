import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

let db: Db | null = null;

export function getDb(url?: string): Db {
  if (db) return db;
  const conn = url ?? process.env["DATABASE_URL"];
  if (!conn) throw new Error("DATABASE_URL manquante");
  const client = postgres(conn, { max: 5 });
  db = drizzle(client, { schema });
  return db;
}

// Exclusion mutuelle du rattrapage : claim atomique sur colonnes (spec 6.2, option B).
// Pas de verrou consultatif : compatible pooler transactionnel (Supabase), et les colonnes
// servent aussi la progression visible (current/total). Voir packages/catchup.

export { schema };
