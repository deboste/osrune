// Schema Drizzle : spec 4 + colonnes de rattrapage (voir ADR-005).
// Les jsonb sont valides par Zod (@osrune/shared) aux frontieres, pas par Postgres.

import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ageEnum = pgEnum("age", ["fire", "steam", "orbital", "oblivion"]);
export const tierEnum = pgEnum("tier", ["free", "paid"]);
export const worldStatusEnum = pgEnum("world_status", ["active", "paused", "over_budget"]);
export const charKindEnum = pgEnum("char_kind", ["figure", "extra"]);
export const genderEnum = pgEnum("gender", ["f", "m"]);
export const daySourceEnum = pgEnum("day_source", ["model", "template"]);
export const actionTypeEnum = pgEnum("action_type", ["decision", "add"]);

export const worlds = pgTable("worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
  age: ageEnum("age").notNull().default("fire"),
  day: integer("day").notNull().default(1),
  state: jsonb("state").notNull(),
  lastSimulatedAt: timestamp("last_simulated_at", { withTimezone: true }).notNull().defaultNow(),
  budgetCentsMonth: integer("budget_cents_month").notNull().default(15),
  spentCentsMonth: numeric("spent_cents_month", { precision: 10, scale: 4 }).notNull().default("0"),
  tier: tierEnum("tier").notNull().default("free"),
  status: worldStatusEnum("status").notNull().default("active"),
  catchupStatus: text("catchup_status").notNull().default("idle"),
  catchupCurrent: integer("catchup_current").notNull().default(0),
  catchupTotal: integer("catchup_total").notNull().default(0),
  catchupStartedAt: timestamp("catchup_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  kind: charKindEnum("kind").notNull(),
  name: text("name").notNull(),
  gender: genderEnum("gender").notNull(),
  ageYears: integer("age_years").notNull(),
  role: text("role").notNull(),
  traits: text("traits").array().notNull().default([]),
  goal: text("goal").notNull().default(""),
  memory: jsonb("memory").notNull().default({ summary: "", facts: [] }),
  quote: text("quote"),
  alive: boolean("alive").notNull().default(true),
});

export const dayLogs = pgTable(
  "day_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    rawEvents: jsonb("raw_events").notNull().default([]),
    condensed: text("condensed").notNull().default(""),
    chronicle: jsonb("chronicle"),
    decision: jsonb("decision"),
    decisionAnswer: text("decision_answer"),
    source: daySourceEnum("source").notNull().default("template"),
    modelId: text("model_id").notNull().default("template"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costCents: numeric("cost_cents", { precision: 8, scale: 4 }).notNull().default("0"),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("day_logs_world_day").on(t.worldId, t.day)],
);

export const playerActions = pgTable("player_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  type: actionTypeEnum("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type World = typeof worlds.$inferSelect;
export type NewWorld = typeof worlds.$inferInsert;
export type DayLog = typeof dayLogs.$inferSelect;
