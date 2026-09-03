// Vue monde pour l'API : etat, chroniques recentes, decision en attente (spec 10).

import { desc, eq } from "drizzle-orm";
import { characters, dayLogs, worlds, type Db } from "@osrune/db";
import { rowToState } from "./store.js";
import { tierBudget } from "./catchup.js";

export interface WorldView {
  world: {
    id: string;
    name: string;
    age: string;
    day: number;
    tier: string;
    status: string;
    resources: { food: number; wood: number; goods: number };
    lastSimulatedAt: string;
    catchup: { status: string; current: number; total: number };
  };
  figures: {
    id: string;
    name: string;
    role: string;
    traits: string[];
    goal: string;
    quote: string | null;
    memory: unknown;
  }[];
  recentDays: { day: number; chronicle: unknown; decision: unknown; source: string }[];
  pendingDecision: { day: number; decision: unknown } | null;
  period: { from: number; to: number; resume: string } | null;
  usage: { spentCentsMonth: number; budgetCentsMonth: number; overBudget: boolean };
}

export async function worldView(db: Db, worldId: string, userId: string): Promise<WorldView> {
  const rows = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("world_not_found");
  if (row.ownerId !== userId) throw new Error("forbidden");
  const state = rowToState(row);
  const chars = await db.select().from(characters).where(eq(characters.worldId, worldId));
  const logs = await db.select().from(dayLogs).where(eq(dayLogs.worldId, worldId)).orderBy(desc(dayLogs.day)).limit(4);
  const withChronicle = logs.filter((l) => l.chronicle).reverse();
  const pending = logs.find((l) => l.decision && !l.decisionAnswer);
  let period: WorldView["period"] = null;
  for (const l of withChronicle) {
    const c = l.chronicle as { period?: { from: number; to: number; resume: string } } | null;
    if (c?.period) {
      period = c.period;
      break;
    }
  }
  return {
    world: {
      id: row.id,
      name: row.name,
      age: row.age,
      day: row.day,
      tier: row.tier,
      status: row.status,
      resources: {
        food: Math.round(state.resources.food),
        wood: Math.round(state.resources.wood),
        goods: Math.round(state.resources.goods),
      },
      lastSimulatedAt: (row.lastSimulatedAt ?? row.createdAt ?? new Date()).toISOString(),
      catchup: { status: row.catchupStatus, current: row.catchupCurrent, total: row.catchupTotal },
    },
    figures: chars
      .filter((c) => c.kind === "figure")
      .map((c) => ({ id: c.id, name: c.name, role: c.role, traits: c.traits, goal: c.goal, quote: c.quote, memory: c.memory })),
    recentDays: withChronicle.slice(-3).map((l) => {
      const raw = l.chronicle;
      const chronicle = Array.isArray(raw) ? { chronique: raw } : raw;
      return { day: l.day, chronicle, decision: l.decision, source: l.source };
    }),
    pendingDecision: pending ? { day: pending.day, decision: pending.decision } : null,
    period,
    usage: {
      spentCentsMonth: Number(row.spentCentsMonth ?? 0),
      budgetCentsMonth: Number(row.budgetCentsMonth ?? tierBudget(row.tier)),
      overBudget: row.status === "over_budget",
    },
  };
}
