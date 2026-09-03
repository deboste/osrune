// Tests Phase 1 sur vraie base Supabase (spec : criteres d'acceptation).
// necessite DATABASE_URL ou ~/.env (SUPABASE_OSRUNE_DATABASE_PASSWORD).

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { templateChronicle, type WriteDayInput, type WriteDayResult } from "@osrune/chronicler";
import { dayLogs, getDb, loadDbUrl, worlds, type Db } from "@osrune/db";
import { addPlayerText, answerDecision, createWorldRow, runCatchup } from "../src/index.js";

let db: Db;
const owned: string[] = [];
const owner = randomUUID();

function mockDay(calls: { n: number }, delayMs = 0) {
  return async (i: WriteDayInput): Promise<WriteDayResult> => {
    calls.n++;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return {
      output: templateChronicle(i.day, i.condensed, "fire", i.figureNames),
      source: "model",
      modelId: "mock",
      tokensIn: 1500,
      tokensOut: 350,
      costCents: 0.01,
      latencyMs: delayMs,
    };
  };
}

async function backdate(worldId: string, daysAgo: number, hours = 24): Promise<void> {
  const past = new Date(Date.now() - daysAgo * hours * 3600_000 - 60_000);
  await db.update(worlds).set({ lastSimulatedAt: past }).where(eq(worlds.id, worldId));
}

beforeAll(() => {
  db = getDb(loadDbUrl());
});

afterAll(async () => {
  for (const id of owned) {
    await db.delete(worlds).where(eq(worlds.id, id));
  }
});

describe("phase 1", () => {
  it("creation en un appel, monde rejoue a l'identique", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Test Village", offline: true });
    owned.push(row.id);
    const a = await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1);
    const b = await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1);
    expect(JSON.stringify(a[0]?.state)).toBe(JSON.stringify(b[0]?.state));
    expect(a[0]?.seed).toBe(row.seed);
  });

  it("5 jours absents => 5 chroniques, < 25 s, progression visible", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Cinq jours", offline: true });
    owned.push(row.id);
    await backdate(row.id, 5);
    const calls = { n: 0 };
    const t0 = Date.now();
    const res = await runCatchup(db, { worldId: row.id, userId: owner, chroniclerDay: mockDay(calls) });
    const ms = Date.now() - t0;
    expect(res.status).toBe("done");
    expect(res.simulatedDays).toBe(5);
    expect(res.days).toHaveLength(5);
    expect(calls.n).toBe(5);
    expect(ms).toBeLessThan(25_000);
    const logs = await db.select().from(dayLogs).where(eq(dayLogs.worldId, row.id));
    expect(logs).toHaveLength(5);
    expect(logs.every((l) => l.chronicle)).toBe(true);
    const w = (await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1))[0];
    expect(w?.catchupStatus).toBe("done");
    expect(w?.catchupTotal).toBe(5);
  });

  it("40 jours => 7 detaillees + 1 resume, jamais plus de 8 appels", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Quarante jours", offline: true });
    owned.push(row.id);
    await backdate(row.id, 40);
    const calls = { n: 0 };
    let periodCalls = 0;
    const res = await runCatchup(db, {
      worldId: row.id,
      userId: owner,
      chroniclerDay: mockDay(calls),
      chroniclerPeriod: async (i) => {
        periodCalls++;
        const { templatePeriod } = await import("@osrune/chronicler");
        return {
          output: templatePeriod(i.from, i.to, i.dayLines.flatMap((d) => d.lines)),
          source: "template",
          modelId: "template",
          tokensIn: 500,
          tokensOut: 120,
          costCents: 0,
          latencyMs: 0,
        };
      },
    });
    expect(res.simulatedDays).toBe(30);
    expect(calls.n).toBe(7);
    expect(periodCalls).toBe(1);
    expect(res.modelCalls).toBeLessThanOrEqual(8);
    expect(res.periodSummary).toBeTruthy();
    const w = (await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1))[0];
    expect(w?.status).toBe("paused");
  });

  it("deux requetes simultanees => un seul rattrapage", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Concurrence", offline: true });
    owned.push(row.id);
    await backdate(row.id, 5);
    const calls = { n: 0 };
    const slow = mockDay(calls, 800);
    const [a, b] = await Promise.all([
      runCatchup(db, { worldId: row.id, userId: owner, chroniclerDay: slow }),
      runCatchup(db, { worldId: row.id, userId: owner, chroniclerDay: slow }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["done", "running"]);
    expect(calls.n).toBe(5);
  });

  it("depassement budget => gabarit + statut over_budget, moteur intact", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Fauche", offline: true });
    owned.push(row.id);
    await db.update(worlds).set({ budgetCentsMonth: 0 }).where(eq(worlds.id, row.id));
    await backdate(row.id, 2);
    const calls = { n: 0 };
    const res = await runCatchup(db, { worldId: row.id, userId: owner, chroniclerDay: mockDay(calls) });
    expect(calls.n).toBe(0);
    expect(res.overBudget).toBe(true);
    expect(res.days.every((d) => d.source === "template")).toBe(true);
    const w = (await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1))[0];
    expect(w?.status).toBe("over_budget");
    expect(w?.day).toBeGreaterThan(1);
  });

  it("decision + ajout joueur", async () => {
    const row = await createWorldRow(db, { ownerId: owner, name: "Joueur", offline: true });
    owned.push(row.id);
    await backdate(row.id, 1);
    const calls = { n: 0 };
    await runCatchup(db, { worldId: row.id, userId: owner, chroniclerDay: mockDay(calls) });
    const ans = await answerDecision(db, { worldId: row.id, userId: owner, option: 0 });
    expect(ans.effects.length).toBeGreaterThanOrEqual(1);
    await expect(answerDecision(db, { worldId: row.id, userId: owner, option: 1 })).rejects.toMatchObject({ status: 409 });
    await addPlayerText(db, { worldId: row.id, userId: owner, text: "Une caravane arrive par le col est." });
    await expect(addPlayerText(db, { worldId: row.id, userId: owner, text: "connard de dragon" })).rejects.toMatchObject({ status: 400 });
  });
});
