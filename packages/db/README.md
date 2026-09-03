# @osrune/db — Phase 1 (non implemente en Phase 0)

Tables prevues (spec 4) : `worlds`, `characters`, `day_logs`, `player_actions`.
Stack : Postgres via Supabase + Drizzle ORM. Schemas Zod dans `@osrune/shared`.

Points durs identifies pendant la revue :
- `characters` est un miroir de `worlds.state.characters`, reecrit en fin de rattrapage (ecrivain unique : le rattrapage).
- Verrou : `pg_advisory_xact_lock(hashtext(world_id::text))`, fallback `catchup_started_at` + expiration 2 min.
- `last_simulated_at = last + n * DAY_LENGTH` (pas `now`), pour ne pas perdre/creer de jours.
- Compaction memoires (7 j) comptee dans le budget ; le plafond "8 appels" devient "8 + 1 compaction si traverse de multiple de 7".
