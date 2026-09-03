// Creation de monde deterministe (spec 4.5, 5.2, 5.3).
// Premier gabarit inspire de la maquette (hall central, marche, 4 maisons,
// champs proches, riviere a l'ouest, foret a l'est), jitter par seed.

import { content } from "@osrune/content";
import type { Age, Building, Character, WorldState } from "./types.js";
import { Rng, normalizeSeed } from "./rng.js";
import { MAP_COLS, MAP_ROWS } from "./constants.js";

export interface CreateWorldOptions {
  name?: string;
  age?: Age;
}

const BASE_ROLES = ["tisserande", "forgeron", "meuniere", "bucheron", "potier"];

function buildMap(rng: Rng): string {
  const cols = MAP_COLS;
  const rows = MAP_ROWS;
  const grid: string[] = new Array(cols * rows).fill(".");
  const set = (c: number, r: number, t: string): void => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    grid[r * cols + c] = t;
  };
  // Riviere a l'ouest + berge de sable
  for (let r = 0; r < rows; r++) {
    set(0, r, "W");
    set(1, r, r === 7 ? "P" : "S");
  }
  // Foret a l'est avec clairieres deterministes
  for (let c = 18; c < 20; c++) {
    for (let r = 0; r < rows; r++) {
      set(c, r, rng.next() < 0.18 ? "." : "F");
    }
  }
  // Champs pres du village
  for (let c = 9; c <= 11; c++) {
    for (let r = 9; r <= 10; r++) set(c, r, "~");
  }
  // Chemins : traversee horizontale + verticale
  for (let c = 1; c <= 17; c++) if (grid[7 * cols + c] === ".") set(c, 7, "P");
  for (let r = 3; r <= 11; r++) if (grid[r * cols + 8] === ".") set(8, r, "P");
  set(1, 7, "P");
  return grid.join("");
}

function jitter(rng: Rng, v: number, amp: number, min: number, max: number): number {
  const d = Math.round((rng.next() * 2 - 1) * amp);
  return Math.min(max, Math.max(min, v + d));
}

export function createWorld(seed: number, options: CreateWorldOptions = {}): WorldState {
  const rng = new Rng(normalizeSeed(seed));
  const age: Age = options.age ?? "fire";
  if (age !== "fire") throw new Error("v1 : seul l'age fire est livre");
  const name = (options.name ?? "Village du Feu").slice(0, 40);
  const tiles = buildMap(rng);
  const fire = content[age];

  const buildings: Building[] = [
    { id: "hall", type: "hall", c: 8, r: 6, progress: 100, capacity: 20 },
    { id: "market", type: "market", c: 10, r: 7, progress: 100, capacity: 20 },
    { id: "house_1", type: "house", c: jitter(rng, 6, 1, 2, 16), r: 5, progress: 100, capacity: 4 },
    { id: "house_2", type: "house", c: 10, r: jitter(rng, 5, 1, 2, 5), progress: 100, capacity: 4 },
    { id: "house_3", type: "house", c: jitter(rng, 6, 1, 2, 16), r: 9, progress: 100, capacity: 4 },
    { id: "house_4", type: "house", c: 11, r: 9, progress: 100, capacity: 4 },
    { id: "field_1", type: "field", c: 10, r: 10, progress: 100, capacity: 6 },
    { id: "forest_1", type: "forest", c: 18, r: 7, progress: 100, capacity: 6 },
    { id: "site_1", type: "site", c: 13, r: 6, progress: 0, capacity: 6 },
  ];

  const names = rng.shuffle([...fire.figureNames]).slice(0, 5);
  const roles = rng.shuffle([...BASE_ROLES]);
  const goals = rng.shuffle([...fire.goals]);
  const workIds = ["field_1", "forest_1", "market", "site_1", "hall"];
  const houses = ["house_1", "house_2", "house_3", "house_4", "house_1"];

  const characters: Character[] = names.map((n, i) => {
    const traits = rng.shuffle([...fire.traits]).slice(0, 3);
    const homeId = houses[i] as string;
    const workId = workIds[i] as string;
    const home = buildings.find((b) => b.id === homeId) as Building;
    return {
      id: `fig_${i + 1}`,
      kind: "figure",
      name: n.name,
      gender: n.gender,
      ageYears: 19 + Math.floor(rng.next() * 38),
      role: roles[i] as string,
      traits,
      goal: goals[i] as string,
      homeId,
      workId,
      needs: {
        food: 65 + Math.floor(rng.next() * 25),
        energy: 65 + Math.floor(rng.next() * 25),
        social: 55 + Math.floor(rng.next() * 30),
      },
      pos: { c: home.c, r: home.r + 1 },
      state: "idle",
      task: null,
      timer: 0,
      memory: { summary: `${n.name} ${roles[i] === "meuniere" ? "travaille" : "travaille"} au village. ${(goals[i] as string).replace(/\.$/, ".")}`, facts: [] },
      quote: null,
    };
  });

  const extraRoles = fire.extraRoles;
  for (let i = 0; i < 7; i++) {
    const homeId = houses[i % houses.length] as string;
    const home = buildings.find((b) => b.id === homeId) as Building;
    characters.push({
      id: `ext_${i + 1}`,
      kind: "extra",
      name: `Figurant ${i + 1}`,
      gender: i % 2 === 0 ? "m" : "f",
      ageYears: 16 + Math.floor(rng.next() * 40),
      role: extraRoles[i % extraRoles.length] as string,
      traits: [],
      goal: "",
      homeId,
      workId: "site_1",
      needs: { food: 70, energy: 75, social: 60 },
      pos: { c: home.c, r: home.r + 1 },
      state: "idle",
      task: null,
      timer: 0,
      memory: { summary: "", facts: [] },
      quote: null,
    });
  }

  // Relations entre figures : 10 paires, 4 non neutres au depart.
  const figs = characters.filter((c) => c.kind === "figure");
  const preset: { type: "friend" | "rival" | "couple" | "mentor"; value: number }[] = [
    { type: "friend", value: 20 },
    { type: "rival", value: -15 },
    { type: "couple", value: 60 },
    { type: "mentor", value: 30 },
  ];
  const relations = [];
  let p = 0;
  for (let i = 0; i < figs.length; i++) {
    for (let j = i + 1; j < figs.length; j++) {
      const a = figs[i] as Character;
      const b = figs[j] as Character;
      if (p < preset.length) {
        const pr = preset[p] as { type: "friend" | "rival" | "couple" | "mentor"; value: number };
        relations.push({ a: a.id, b: b.id, type: pr.type, value: pr.value });
      } else {
        relations.push({ a: a.id, b: b.id, type: "neutral" as const, value: 0 });
      }
      p++;
    }
  }

  return {
    version: 1,
    seed,
    rng: rng.state,
    day: 1,
    tick: 0,
    age,
    name,
    map: { cols: MAP_COLS, rows: MAP_ROWS, tiles },
    buildings,
    characters,
    resources: { food: 60, wood: 50, goods: 30 },
    relations,
    pendingEffects: [],
    playerAdds: [],
    log: [],
  };
}

export function snapshot(state: WorldState): WorldState {
  return JSON.parse(JSON.stringify(state)) as WorldState;
}
