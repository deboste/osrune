// Effets des decisions du joueur (spec 4.5, 7.3).
// Revalides cote moteur : delta borne, cibles connues, clamp.

import type { Effect, RawEvent, WorldState } from "./types.js";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Applique les effets en attente au debut du jour suivant. Retourne le nb applique. */
export function applyPendingEffects(
  state: WorldState,
  log?: (e: RawEvent) => void,
): number {
  let applied = 0;
  for (const e of state.pendingEffects) {
    if (!Number.isInteger(e.delta) || e.delta < -20 || e.delta > 20) continue;
    if (e.target === "resources") {
      if (e.id === "food" || e.id === "wood" || e.id === "goods") {
        state.resources[e.id] = clamp(state.resources[e.id] + e.delta, 0, 100);
        applied++;
        log?.({ tick: 0, type: "effect", actors: [], place: "village", data: { target: "resources", id: e.id, delta: e.delta } });
      }
    } else if (e.target === "relation") {
      // id attendu "idA:idB" (ecart spec : ids stables, pas noms. Voir ADR-003).
      const [a, b] = String(e.id ?? "").split(":");
      const rel = state.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
      if (rel && a && b) {
        rel.value = clamp(rel.value + e.delta, -100, 100);
        applied++;
        log?.({ tick: 0, type: "effect", actors: [], place: "village", data: { target: "relation", id: e.id, delta: e.delta } });
      }
    }
    // character / building : reserves, sans effet mecanique en v1 (journalise quand meme).
  }
  state.pendingEffects = [];
  return applied;
}

/** File des effets depuis une decision du joueur (valide les bornes). */
export function queueEffects(state: WorldState, effects: Effect[]): void {
  for (const e of effects.slice(0, 9)) {
    if (e.delta < -20 || e.delta > 20) continue;
    state.pendingEffects.push(e);
  }
}
