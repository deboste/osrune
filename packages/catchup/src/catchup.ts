// Rattrapage a la connexion : spec 6. Le coeur de l'economie du produit.
// - Claim atomique sur colonnes (exclusion mutuelle + progression visible).
// - Au maximum 8 appels modele par rattrapage (7 jours + 1 resume), quel que soit n.
// - Budget verifie avant chaque appel : gabarit + statut over_budget, jamais de coupure moteur.
// - last_simulated_at avance de n * DAY_LENGTH (pas de now()), pour ne perdre aucun jour.

import { and, desc, eq, gte, or, sql, lt } from "drizzle-orm";
import { randomInt } from "node:crypto";
import {
  buildPrompt,
  costCents,
  createFigures,
  envPricing,
  estimateTokens,
  type WriteDayInput,
  type WriteDayResult,
  type WritePeriodInput,
  type WritePeriodResult,
} from "@osrune/chronicler";
import { content } from "@osrune/content";
import { dayLogs, worlds, playerActions, type Db, type World } from "@osrune/db";
import { condenseLog, createWorld, queueEffects, runDay, type Effect, type WorldState } from "@osrune/engine";
import { insertDayLog, resetMonthIfNeeded, rowToState, stateToJson, syncCharacters } from "./store.js";

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CatchupDeps {
  chroniclerDay?: (i: WriteDayInput) => Promise<WriteDayResult>;
  chroniclerPeriod?: (i: WritePeriodInput) => Promise<WritePeriodResult>;
  offline?: boolean;
}

export interface CatchupDay {
  day: number;
  source: "model" | "template";
  tokensIn: number;
  tokensOut: number;
}

export interface CatchupResult {
  status: "idle" | "running" | "done" | "paused";
  worldId: string;
  missedDays: number;
  simulatedDays: number;
  modelCalls: number;
  costCents: number;
  overBudget: boolean;
  days: CatchupDay[];
  periodSummary: string | null;
  currentDay?: number;
  totalDays?: number;
}

export const MAX_DETAILED = 7;
export const MAX_DAYS = 30;

export function dayLengthHours(tier: string): number {
  if (tier === "paid") return Number(process.env["DAY_LENGTH_HOURS_PAID"] ?? 8);
  return Number(process.env["DAY_LENGTH_HOURS_FREE"] ?? 24);
}

export function tierBudget(tier: string): number {
  if (tier === "paid") return Number(process.env["BUDGET_CENTS_PAID_MONTH"] ?? 200);
  return Number(process.env["BUDGET_CENTS_FREE_MONTH"] ?? 15);
}

export function computeMissedDays(last: Date, now: Date, hours: number): number {
  return Math.max(0, Math.floor((now.getTime() - last.getTime()) / (hours * 3600_000)));
}

async function loadOwned(db: Db, worldId: string, userId: string): Promise<World> {
  const rows = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, "world_not_found", "Monde introuvable.");
  if (row.ownerId !== userId) throw new HttpError(403, "forbidden", "Ce monde ne vous appartient pas.");
  return row;
}

/** Claim atomique : une seule execution a la fois (+ expiration 2 min si crash). */
async function claim(db: Db, worldId: string, total: number, now: Date): Promise<boolean> {
  const expiry = new Date(now.getTime() - 120_000);
  const r = await db
    .update(worlds)
    .set({ catchupStatus: "running", catchupCurrent: 0, catchupTotal: total, catchupStartedAt: now })
    .where(
      and(
        eq(worlds.id, worldId),
        or(eq(worlds.catchupStatus, "idle"), eq(worlds.catchupStatus, "done"), lt(worlds.catchupStartedAt, expiry)),
      ),
    )
    .returning({ id: worlds.id });
  return r.length > 0;
}

async function progress(db: Db, worldId: string, current: number, state: WorldState): Promise<void> {
  await db
    .update(worlds)
    .set({ catchupCurrent: current, state: stateToJson(state), updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

async function dayCostToday(db: Db): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const r = await db
    .select({ s: sql<string>`COALESCE(SUM(cost_cents), 0)` })
    .from(dayLogs)
    .where(gte(dayLogs.createdAt, start));
  return Number(r[0]?.s ?? 0);
}

export async function runCatchup(
  db: Db,
  opts: { worldId: string; userId: string; now?: Date; force?: boolean } & CatchupDeps,
): Promise<CatchupResult> {
  const now = opts.now ?? new Date();
  const dayFn = opts.chroniclerDay;
  const periodFn = opts.chroniclerPeriod;
  const offline = opts.offline ?? false;
  const base: CatchupResult = {
    status: "idle",
    worldId: opts.worldId,
    missedDays: 0,
    simulatedDays: 0,
    modelCalls: 0,
    costCents: 0,
    overBudget: false,
    days: [],
    periodSummary: null,
  };

  let row = await loadOwned(db, opts.worldId, opts.userId);
  row = await resetMonthIfNeeded(db, row, now);
  const hours = dayLengthHours(row.tier);
  const last = row.lastSimulatedAt ?? row.createdAt;
  const missed = computeMissedDays(last, now, hours);
  base.missedDays = missed;
  if (missed < 1) return base;
  if (row.status === "paused" && !opts.force) return { ...base, status: "paused" };

  const n = Math.min(missed, MAX_DAYS);
  const claimed = await claim(db, row.id, n, now);
  if (!claimed) {
    const cur = (await db.select().from(worlds).where(eq(worlds.id, row.id)).limit(1))[0];
    return { ...base, status: "running", currentDay: cur?.catchupCurrent ?? 0, totalDays: cur?.catchupTotal ?? n };
  }

  const finish = async (patch: Partial<World>): Promise<void> => {
    await db.update(worlds).set({ ...patch, updatedAt: now }).where(eq(worlds.id, row.id));
  };

  try {
    const state = rowToState(row);
    const age = content[state.age];
    const { priceInPerM, priceOutPerM } = envPricing();
    // Le budget effectif est la colonne (modifiable par palier/admin), avec le palier en repli.
    const budget = Number(row.budgetCentsMonth ?? tierBudget(row.tier));
    const globalCap = Number(process.env["GLOBAL_DAILY_CENTS_CAP"] ?? 500);
    let spent = Number(row.spentCentsMonth ?? 0);
    let globalToday = await dayCostToday(db);
    let overBudget = false;
    let modelCalls = 0;
    let cost = 0;

    // Chroniques recentes pour le contexte (3 derniers jours detailles).
    const prev = await db
      .select()
      .from(dayLogs)
      .where(eq(dayLogs.worldId, row.id))
      .orderBy(desc(dayLogs.day))
      .limit(3);
    const recent: string[] = prev
      .reverse()
      .filter((d) => d.chronicle)
      .map((d) => {
        const c = d.chronicle as { chronique?: { texte: string }[] } | null;
        return `Jour ${d.day} : ${(c?.chronique ?? []).map((e) => e.texte).join(" ")}`;
      });

    const oldDays: { day: number; lines: string[] }[] = [];
    const detailedFirstDay = state.day + (n - Math.min(n, MAX_DETAILED));
    void detailedFirstDay;
    const days: CatchupDay[] = [];

    for (let i = 1; i <= n; i++) {
      const dayNum = state.day;
      runDay(state);
      const condensed = condenseLog(state, dayNum);
      const detailed = i > n - MAX_DETAILED;

      if (!detailed) {
        oldDays.push({ day: dayNum, lines: condensed });
        await insertDayLog(db, {
          worldId: row.id,
          day: dayNum,
          rawEvents: state.log.slice(-50),
          condensed: condensed.join("\n"),
          chronicle: null,
          decision: null,
          source: "template",
          modelId: "condensed-only",
          tokensIn: 0,
          tokensOut: 0,
          costCents: 0,
          latencyMs: 0,
        });
        await progress(db, row.id, i, state);
        days.push({ day: dayNum, source: "template", tokensIn: 0, tokensOut: 0 });
        continue;
      }

      const figs = state.characters.filter((c) => c.kind === "figure");
      const prompt = buildPrompt({
        worldName: state.name,
        ageLabel: age.label,
        ageContext: age.oneLineContext,
        food: state.resources.food,
        wood: state.resources.wood,
        goods: state.resources.goods,
        figures: figs.map((f) => ({
          name: f.name,
          role: f.role,
          ageYears: f.ageYears,
          traits: f.traits,
          goal: f.goal,
          summary: f.memory.summary,
        })),
        relations: state.relations
          .filter((r) => r.type !== "neutral")
          .map((r) => {
            const an = state.characters.find((c) => c.id === r.a)?.name ?? r.a;
            const bn = state.characters.find((c) => c.id === r.b)?.name ?? r.b;
            return `${an} et ${bn} : ${r.type} (${r.value})`;
          }),
        recent: recent.slice(-3),
        decisionYesterday: "aucune",
        answerYesterday: "aucune reponse",
        adds: [],
        day: dayNum,
        condensed,
      });

      const estIn = estimateTokens(prompt);
      const estCost = costCents({ tokensIn: estIn, tokensOut: 400, priceInPerM, priceOutPerM });
      const useTemplate = offline || overBudget || spent + estCost > budget || globalToday + estCost > globalCap;
      if (!offline && (spent + estCost > budget || globalToday + estCost > globalCap)) overBudget = true;

      let res: WriteDayResult;
      if (useTemplate || !dayFn) {
        const { templateChronicle } = await import("@osrune/chronicler");
        res = {
          output: templateChronicle(dayNum, condensed, "fire", figs.map((f) => f.name)),
          source: "template",
          modelId: "template",
          tokensIn: estIn,
          tokensOut: 180,
          costCents: 0,
          latencyMs: 0,
        };
      } else {
        res = await dayFn({ prompt, day: dayNum, condensed, figureNames: figs.map((f) => f.name), offline: false });
        modelCalls++;
      }
      spent += res.costCents;
      globalToday += res.costCents;
      cost += res.costCents;

      for (const f of figs) {
        const q = res.output.repliques[f.name];
        if (q) f.quote = String(q).slice(0, 60);
        const m = res.output.memoires[f.name];
        if (m) {
          f.memory.facts.push(String(m).slice(0, 160));
          if (f.memory.facts.length > 10) f.memory.facts.shift();
        }
      }
      const dayText = `Jour ${dayNum} : ${res.output.chronique.map((c) => c.texte).join(" ")}`;
      recent.push(dayText);

      await insertDayLog(db, {
        worldId: row.id,
        day: dayNum,
        rawEvents: state.log.slice(-50),
        condensed: condensed.join("\n"),
        chronicle: res.output.chronique,
        decision: res.output.decision,
        source: res.source,
        modelId: res.modelId,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        costCents: res.costCents,
        latencyMs: res.latencyMs,
      });
      await progress(db, row.id, i, state);
      days.push({ day: dayNum, source: res.source, tokensIn: res.tokensIn, tokensOut: res.tokensOut });
    }

    // Resume de periode : un seul appel pour tous les jours anciens.
    let periodSummary: string | null = null;
    if (oldDays.length > 0) {
      const from = oldDays[0]?.day ?? 0;
      const to = oldDays[oldDays.length - 1]?.day ?? 0;
      const estIn = oldDays.reduce((a, d) => a + d.lines.join("\n").length, 0) / 4;
      const estCost = costCents({ tokensIn: estIn, tokensOut: 300, priceInPerM, priceOutPerM });
      const useTemplate = offline || overBudget || spent + estCost > budget || globalToday + estCost > globalCap;
      let pres: WritePeriodResult;
      if (useTemplate || !periodFn) {
        const { templatePeriod } = await import("@osrune/chronicler");
        pres = {
          output: templatePeriod(from, to, oldDays.flatMap((d) => d.lines)),
          source: "template",
          modelId: "template",
          tokensIn: estIn,
          tokensOut: 120,
          costCents: 0,
          latencyMs: 0,
        };
      } else {
        pres = await periodFn({ from, to, dayLines: oldDays, offline: false });
        modelCalls++;
      }
      spent += pres.costCents;
      cost += pres.costCents;
      periodSummary = pres.output.resume;
      // Persiste avec le premier jour detaille : "Les jours X a Y en bref" en tete.
      const firstDetailed = days.find((d) => d.source === "model" || d.source === "template");
      if (firstDetailed) {
        const existing = await db
          .select()
          .from(dayLogs)
          .where(and(eq(dayLogs.worldId, row.id), eq(dayLogs.day, firstDetailed.day)))
          .limit(1);
        const cur = existing[0]?.chronicle as Record<string, unknown> | null;
        await db
          .update(dayLogs)
          .set({ chronicle: { ...(cur ?? {}), period: { from, to, resume: periodSummary } } })
          .where(and(eq(dayLogs.worldId, row.id), eq(dayLogs.day, firstDetailed.day)));
      }
    }

    const newLast = new Date(last.getTime() + n * hours * 3600_000);
    const paused = missed > MAX_DAYS;
    await finish({
      state: stateToJson(state),
      day: state.day,
      lastSimulatedAt: newLast,
      spentCentsMonth: String(spent),
      status: overBudget ? "over_budget" : paused ? "paused" : "active",
      catchupStatus: "done",
      catchupCurrent: n,
    });
    await syncCharacters(db, row.id, state);

    return {
      ...base,
      status: paused ? "paused" : "done",
      missedDays: missed,
      simulatedDays: n,
      modelCalls,
      costCents: cost,
      overBudget,
      days,
      periodSummary,
    };
  } catch (e) {
    await finish({ catchupStatus: "idle" });
    throw e;
  }
}

export interface CreateWorldOpts {
  ownerId: string;
  name: string;
  userPrompt?: string;
  tier?: "free" | "paid";
  offline?: boolean;
  now?: Date;
}

export async function createWorldRow(db: Db, opts: CreateWorldOpts): Promise<World> {
  const now = opts.now ?? new Date();
  const name = opts.name.slice(0, 40) || "Village du Feu";
  if (name.length < 2) throw new HttpError(400, "bad_name", "Nom de monde trop court.");
  const seed = randomInt(1, 2_000_000_000);
  const tier = opts.tier ?? "free";
  const state = createWorld(seed, { name });

  // Une fois le chroniqueur : identite des 5 figures. Gabarit deterministe en secours.
  const figInput: { worldName: string; seed: number; offline?: boolean; userPrompt?: string } = {
    worldName: name,
    seed,
  };
  if (opts.offline !== undefined) figInput.offline = opts.offline;
  if (opts.userPrompt !== undefined) figInput.userPrompt = opts.userPrompt;
  const { figures } = await createFigures(figInput);
  const figs = state.characters.filter((c) => c.kind === "figure");
  figures.slice(0, 5).forEach((d, i) => {
    const f = figs[i];
    if (!f) return;
    f.name = d.name;
    f.gender = d.gender;
    f.ageYears = d.ageYears;
    f.role = d.role;
    f.traits = [...d.traits];
    f.goal = d.goal;
    f.memory = { summary: `${d.name}, ${d.role}. ${d.goal}`, facts: [] };
  });

  const inserted = await db
    .insert(worlds)
    .values({
      ownerId: opts.ownerId,
      name,
      seed,
      age: "fire",
      day: 1,
      state: stateToJson(state),
      lastSimulatedAt: now,
      budgetCentsMonth: tierBudget(tier),
      spentCentsMonth: "0",
      tier,
      status: "active",
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new HttpError(500, "create_failed", "Creation impossible.");
  await syncCharacters(db, row.id, state);
  return row;
}

export interface DecisionOpts {
  worldId: string;
  userId: string;
  option: number;
}

const FORBIDDEN = ["connard", "conasse", "salope", "putain", "pute", "merde", "encule", "bite", "couille", "cul", "porno", "sexe", "viol", "tuer", "suicide", "foutre"];

export function moderate(text: string): boolean {
  const low = ` ${text.toLowerCase().normalize("NFC")} `;
  return FORBIDDEN.some((w) => low.split(/[^a-zàâäéèêëîïôöùûüçœæ]+/i).includes(w));
}

export async function answerDecision(db: Db, opts: DecisionOpts): Promise<{ effects: Effect[] }> {
  const row = await loadOwned(db, opts.worldId, opts.userId);
  const logs = await db
    .select()
    .from(dayLogs)
    .where(eq(dayLogs.worldId, row.id))
    .orderBy(desc(dayLogs.day))
    .limit(5);
  const target = logs.find((l) => l.decision && !l.decisionAnswer);
  if (!target) throw new HttpError(409, "no_decision", "Aucune decision en attente.");
  const dec = target.decision as { titre?: string; options?: { label: string; effets: { target: string; id: string; delta: number }[] }[] };
  const options = dec.options ?? [];
  if (!Number.isInteger(opts.option) || opts.option < 0 || opts.option >= options.length) {
    throw new HttpError(400, "bad_option", "Option invalide.");
  }
  const chosen = options[opts.option];
  if (!chosen) throw new HttpError(400, "bad_option", "Option invalide.");
  const state = rowToState(row);
  const effects: Effect[] = (chosen.effets ?? [])
    .filter((e) => (e.target === "resources" || e.target === "relation") && Number.isInteger(e.delta) && e.delta >= -20 && e.delta <= 20)
    .map((e) => ({ target: e.target as "resources" | "relation", id: e.id, field: e.id, delta: e.delta, reason: String(dec.titre ?? "decision").slice(0, 120) }));
  queueEffects(state, effects);
  await db
    .update(dayLogs)
    .set({ decisionAnswer: chosen.label })
    .where(eq(dayLogs.id, target.id));
  await db.insert(playerActions).values({ worldId: row.id, day: state.day, type: "decision", payload: { option: opts.option, label: chosen.label } });
  await db.update(worlds).set({ state: stateToJson(state), updatedAt: new Date() }).where(eq(worlds.id, row.id));
  return { effects };
}

export async function addPlayerText(db: Db, opts: { worldId: string; userId: string; text: string }): Promise<void> {
  const text = opts.text.trim().slice(0, 200);
  if (text.length < 2) throw new HttpError(400, "bad_text", "Texte trop court.");
  if (moderate(text)) throw new HttpError(400, "rejected", "Ce texte ne convient pas au village.");
  const row = await loadOwned(db, opts.worldId, opts.userId);
  const state = rowToState(row);
  if (state.playerAdds.length >= 3) throw new HttpError(429, "too_many", "3 ajouts par jour maximum.");
  state.playerAdds.push(text);
  await db.insert(playerActions).values({ worldId: row.id, day: state.day, type: "add", payload: { text } });
  await db.update(worlds).set({ state: stateToJson(state), updatedAt: new Date() }).where(eq(worlds.id, row.id));
}

/** Avance d'un jour, reserve dev/test (route verrouillee en production). */
export async function advanceOneDay(
  db: Db,
  opts: { worldId: string; userId: string; now?: Date } & CatchupDeps,
): Promise<CatchupDay> {
  const now = opts.now ?? new Date();
  let row = await loadOwned(db, opts.worldId, opts.userId);
  row = await resetMonthIfNeeded(db, row, now);
  const hours = dayLengthHours(row.tier);
  const state = rowToState(row);
  const dayNum = state.day;
  runDay(state);
  const condensed = condenseLog(state, dayNum);
  const figs = state.characters.filter((c) => c.kind === "figure");
  const age = content[state.age];
  const prompt = buildPrompt({
    worldName: state.name,
    ageLabel: age.label,
    ageContext: age.oneLineContext,
    food: state.resources.food,
    wood: state.resources.wood,
    goods: state.resources.goods,
    figures: figs.map((f) => ({
      name: f.name,
      role: f.role,
      ageYears: f.ageYears,
      traits: f.traits,
      goal: f.goal,
      summary: f.memory.summary,
    })),
    relations: [],
    recent: [],
    decisionYesterday: "aucune",
    answerYesterday: "aucune reponse",
    adds: [],
    day: dayNum,
    condensed,
  });
  let res: WriteDayResult;
  if (opts.chroniclerDay && !opts.offline) {
    res = await opts.chroniclerDay({ prompt, day: dayNum, condensed, figureNames: figs.map((f) => f.name) });
  } else {
    const { templateChronicle } = await import("@osrune/chronicler");
    res = {
      output: templateChronicle(dayNum, condensed, "fire", figs.map((f) => f.name)),
      source: "template",
      modelId: "template",
      tokensIn: estimateTokens(prompt),
      tokensOut: 180,
      costCents: 0,
      latencyMs: 0,
    };
  }
  await insertDayLog(db, {
    worldId: row.id,
    day: dayNum,
    rawEvents: state.log.slice(-50),
    condensed: condensed.join("\n"),
    chronicle: res.output.chronique,
    decision: res.output.decision,
    source: res.source,
    modelId: res.modelId,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    costCents: res.costCents,
    latencyMs: res.latencyMs,
  });
  const last = row.lastSimulatedAt ?? now;
  await db
    .update(worlds)
    .set({
      state: stateToJson(state),
      day: state.day,
      lastSimulatedAt: new Date(last.getTime() + hours * 3600_000),
      spentCentsMonth: String(Number(row.spentCentsMonth ?? 0) + res.costCents),
      updatedAt: now,
    })
    .where(eq(worlds.id, row.id));
  await syncCharacters(db, row.id, state);
  return { day: dayNum, source: res.source, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
}
