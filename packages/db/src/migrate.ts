#!/usr/bin/env node
// Applique les migrations Drizzle (sauf si deja appliquees via supabase db push)
// puis le RLS (idempotent).

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadDbUrl } from "./url.js";

const url = loadDbUrl();
const client = postgres(url, { max: 1 });

const applied = await client`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'worlds'`;
if (applied.length === 0) {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), "../migrations") });
  console.log("migrations appliquees (drizzle)");
} else {
  console.log("tables presentes (supabase db push), migrations drizzle ignorees");
}

// RLS : voir schema. Idempotent via DROP IF EXISTS.
await client.unsafe(`
  ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
  ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
  ALTER TABLE day_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE player_actions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS own_worlds ON worlds;
  CREATE POLICY own_worlds ON worlds FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  DROP POLICY IF EXISTS own_characters ON characters;
  CREATE POLICY own_characters ON characters FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM worlds w WHERE w.id = characters.world_id AND w.owner_id = auth.uid()));
  DROP POLICY IF EXISTS own_day_logs ON day_logs;
  CREATE POLICY own_day_logs ON day_logs FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM worlds w WHERE w.id = day_logs.world_id AND w.owner_id = auth.uid()));
  DROP POLICY IF EXISTS own_player_actions ON player_actions;
  CREATE POLICY own_player_actions ON player_actions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM worlds w WHERE w.id = player_actions.world_id AND w.owner_id = auth.uid()));
`);
console.log("rls ok");
await client.end();
