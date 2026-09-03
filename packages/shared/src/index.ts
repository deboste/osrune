import { z } from "zod";

// --- Constantes economie (spec 11) ---
export const AGES = ["fire", "steam", "orbital", "oblivion"] as const;
export type Age = (typeof AGES)[number];

export const DAY_TICKS = 48;
export const MAP_COLS = 20;
export const MAP_ROWS = 14;
export const MAX_RAW_EVENTS = 200;
export const MAX_CONDENSED_LINES = 40;
export const MAX_CHRONICLE_ENTRIES = 3;
export const MAX_TOKENS_OUT = 600;

// --- Moteur : schemas Zod (source unique, spec 4.5 / 12) ---
export const NeedsSchema = z.object({
  food: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
});

export const CharacterSchema = z.object({
  id: z.string().max(32),
  kind: z.enum(["figure", "extra"]),
  name: z.string().max(40),
  gender: z.enum(["f", "m"]),
  ageYears: z.number().int().min(0).max(120),
  role: z.string().max(30),
  traits: z.array(z.string().max(24)).max(3),
  goal: z.string().max(80),
  homeId: z.string().max(32),
  workId: z.string().max(32),
  needs: NeedsSchema,
  pos: z.object({ c: z.number().int(), r: z.number().int() }),
  state: z.enum(["idle", "walk", "work", "eat", "sleep", "talk"]),
  task: z.string().max(64).nullable(),
  timer: z.number().int().min(0).max(96),
  memory: z.object({
    summary: z.string().max(1200),
    facts: z.array(z.string().max(160)).max(10),
  }),
  quote: z.string().max(60).nullable(),
});

export const BuildingSchema = z.object({
  id: z.string().max(32),
  type: z.enum(["house", "hall", "market", "site", "field", "forest"]),
  c: z.number().int(),
  r: z.number().int(),
  progress: z.number().min(0).max(100),
  capacity: z.number().int().min(0).max(50),
});

export const RelationSchema = z.object({
  a: z.string().max(32),
  b: z.string().max(32),
  type: z.enum(["rival", "friend", "couple", "mentor", "neutral"]),
  value: z.number().int().min(-100).max(100),
});

export const EffectSchema = z.object({
  target: z.enum(["resources", "relation", "character", "building"]),
  id: z.string().max(64).optional(),
  field: z.string().max(32),
  delta: z.number().int().min(-20).max(20),
  reason: z.string().max(120),
});

export const RawEventSchema = z.object({
  tick: z.number().int().min(0).max(47),
  type: z.string().max(32),
  actors: z.array(z.string().max(40)).max(6),
  place: z.string().max(24),
  data: z.record(z.unknown()).optional(),
});

export const WorldStateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  rng: z.number().int(),
  day: z.number().int().min(1),
  tick: z.number().int().min(0).max(47),
  age: z.enum(["fire", "steam", "orbital", "oblivion"]),
  name: z.string().max(40),
  map: z.object({
    cols: z.number().int(),
    rows: z.number().int(),
    tiles: z.string(),
  }),
  buildings: z.array(BuildingSchema).max(40),
  characters: z.array(CharacterSchema).max(40),
  resources: z.object({
    food: z.number(),
    wood: z.number(),
    goods: z.number(),
  }),
  relations: z.array(RelationSchema).max(200),
  pendingEffects: z.array(EffectSchema).max(12),
  playerAdds: z.array(z.string().max(200)).max(3),
  log: z.array(RawEventSchema).max(220),
});

export type WorldState = z.infer<typeof WorldStateSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Building = z.infer<typeof BuildingSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type RawEvent = z.infer<typeof RawEventSchema>;

// --- Chroniques : colonne day_logs.chronicle -------------------------------
// Nouveau format : objet {chronique: [...], period?}. Ancien : tableau brut.
export interface ChronicleEntryLite {
  texte: string;
  lieu: string;
}

export function normChronicle(c: unknown): ChronicleEntryLite[] {
  if (Array.isArray(c)) return c as ChronicleEntryLite[];
  const o = c as { chronique?: ChronicleEntryLite[] } | null;
  return o?.chronique ?? [];
}

// --- Utilitaire seed (spec 12 : deterministe) ---
export function hashSeed(seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}
