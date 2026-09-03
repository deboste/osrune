#!/usr/bin/env node
// CLI osrune : simule N jours et imprime journal condense + chronique (spec Phase 0).
// Usage : osrune sim --days 30 --seed 42 [--offline] [--name "Village"]

import { createHash } from "node:crypto";
import { createWorld, runDay, condenseLog, type WorldState } from "@osrune/engine";
import { buildPrompt, writeDay, estimateTokens } from "@osrune/chronicler";
import { content } from "@osrune/content";

const ARGS = process.argv.slice(2).filter((a) => a !== "--");

function arg(name: string, fallback?: string): string | undefined {
  const i = ARGS.indexOf(name);
  if (i === -1) return fallback;
  return ARGS[i + 1] ?? fallback;
}
function flag(name: string): boolean {
  return ARGS.includes(name);
}

async function cmdSim(): Promise<void> {
  const days = Number(arg("--days", "30"));
  const seed = Number(arg("--seed", "42"));
  const offline = flag("--offline") || !process.env["OPENROUTER_API_KEY"];
  const name = arg("--name", "Village du Feu") as string;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("--days 1..365");
  if (!Number.isInteger(seed)) throw new Error("--seed entier");

  let state: WorldState = createWorld(seed, { name });
  const age = content[state.age];
  const hash = createHash("sha256");
  let tin = 0;
  let tout = 0;
  const recent: string[] = [];

  for (let d = 0; d < days; d++) {
    const dayNum = state.day;
    runDay(state);
    const condensed = condenseLog(state, dayNum);
    for (const l of condensed) hash.update(l);
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
    const r = await writeDay({ prompt, day: dayNum, condensed, figureNames: figs.map((f) => f.name), offline });
    tin += r.tokensIn;
    tout += r.tokensOut;
    // Applique repliques + memoires a l'etat (figures uniquement)
    for (const f of figs) {
      const q = r.output.repliques[f.name];
      if (q) f.quote = String(q).slice(0, 60);
      const m = r.output.memoires[f.name];
      if (m) {
        f.memory.facts.push(String(m).slice(0, 160));
        if (f.memory.facts.length > 10) f.memory.facts.shift();
      }
    }
    recent.push(`Jour ${dayNum} : ${r.output.chronique.map((c) => c.texte).join(" ")}`);

    console.log(`--- Jour ${dayNum} [${r.source}] in=${r.tokensIn} out=${r.tokensOut} ---`);
    for (const l of condensed) console.log(`  ${l}`);
    for (const c of r.output.chronique) console.log(`  * ${c.texte} [${c.lieu}${c.alerte ? " !alerte" : ""}]`);
    console.log(`  ? ${r.output.decision.titre} : ${r.output.decision.options.map((o) => o.label).join(" / ")}`);
  }
  console.log(`\nhash=${hash.digest("hex").slice(0, 16)} jours=${days} seed=${seed} tokens_in=${tin} tokens_out=${tout} cout_est_cts=${((tin / 1e6) * 0.07 * 100 + (tout / 1e6) * 0.28 * 100).toFixed(3)}`);
  void estimateTokens;
}

async function main(): Promise<void> {
  const cmd = ARGS[0];
  if (cmd === "sim") await cmdSim();
  else {
    console.log("Usage: osrune sim --days 30 --seed 42 [--offline]");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`error: ${String(e)}`);
  process.exit(1);
});
