// Passerelle base <-> moteur : validation Zod aux frontieres (ADR-001).

import { eq } from "drizzle-orm";
import { WorldStateSchema, type WorldState as SharedState } from "@osrune/shared";
import type { WorldState as EngineState } from "@osrune/engine";
import { characters, dayLogs, worlds, type Db, type World } from "@osrune/db";

/** Charge et valide l'etat moteur d'un monde. L indoor. */
export function rowToState(row: World): EngineState {
  const parsed = WorldStateSchema.parse(row.state) as SharedState;
  return parsed as unknown as EngineState;
}

export function stateToJson(state: EngineState): unknown {
  return JSON.parse(JSON.stringify(state)) as unknown;
}

/** Reecrit la table characters depuis l'etat (ecrivain unique : fin de rattrapage). */
export async function syncCharacters(db: Db, worldId: string, state: EngineState): Promise<void> {
  await db.delete(characters).where(eq(characters.worldId, worldId));
  if (state.characters.length === 0) return;
  await db.insert(characters).values(
    state.characters.map((c) => ({
      worldId,
      kind: c.kind,
      name: c.name,
      gender: c.gender,
      ageYears: c.ageYears,
      role: c.role,
      traits: c.traits,
      goal: c.goal,
      memory: { summary: c.memory.summary, facts: c.memory.facts },
      quote: c.quote,
    })),
  );
}

export async function insertDayLog(
  db: Db,
  row: {
    worldId: string;
    day: number;
    rawEvents: unknown;
    condensed: string;
    chronicle: unknown;
    decision: unknown;
    source: "model" | "template";
    modelId: string;
    tokensIn: number;
    tokensOut: number;
    costCents: number;
    latencyMs: number;
  },
): Promise<void> {
  await db.insert(dayLogs).values({
    worldId: row.worldId,
    day: row.day,
    rawEvents: row.rawEvents,
    condensed: row.condensed,
    chronicle: row.chronicle,
    decision: row.decision,
    source: row.source,
    modelId: row.modelId,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costCents: String(row.costCents),
    latencyMs: row.latencyMs,
  });
}

export async function resetMonthIfNeeded(db: Db, row: World, now: Date): Promise<World> {
  const updated = row.updatedAt ?? row.createdAt;
  if (updated && updated.getUTCFullYear() === now.getUTCFullYear() && updated.getUTCMonth() === now.getUTCMonth()) {
    return row;
  }
  await db.update(worlds).set({ spentCentsMonth: "0", updatedAt: now }).where(eq(worlds.id, row.id));
  return { ...row, spentCentsMonth: "0" };
}
