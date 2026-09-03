// Ages : seuils et passage (spec 5.6). Non active en v1, mais la fonction et son test existent.

import type { WorldState } from "./types.js";

export interface AgeGate {
  houses: number;
  day: number;
}

export const AGE_GATES: Record<string, AgeGate> = {
  fire: { houses: 8, day: 30 },
};

export function canAdvanceAge(state: WorldState): boolean {
  if (state.age !== "fire") return false;
  const houses = state.buildings.filter((b) => b.type === "house").length;
  const gate = AGE_GATES["fire"] as AgeGate;
  return houses >= gate.houses && state.day >= gate.day;
}

/** v1 : toujours false (passage desactive). Existe pour le test et la phase 4. */
export function advanceAge(_state: WorldState): boolean {
  return false;
}
