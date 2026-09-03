# @osrune/db — Phase 1 (livre)

Tables (spec 4) : `worlds` (+ colonnes `catchup_*`, voir ADR-005), `characters`, `day_logs`, `player_actions`.
Drizzle ORM + driver `postgres` (pooler `aws-1-eu-west-3`, cf. rapport Phase 1).
Migrations : `pnpm --filter @osrune/db db:generate` puis `supabase db push` (projet lie) ;
`src/migrate.ts` applique le RLS (idempotent).

Points durs tranches (voir ADR-005/006) :
- `characters` est un miroir de `worlds.state.characters`, reecrit en fin de rattrapage (ecrivain unique).
- Exclusion mutuelle : claim atomique sur colonnes, pas de verrou consultatif (pooler).
- `last_simulated_at = last + n * DAY_LENGTH` (pas `now()`).
- Compaction memoires differee (faits plafonnes a 10, prompts bornes).
