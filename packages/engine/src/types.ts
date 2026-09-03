// Types internes du moteur. Miroir des schemas Zod de @osrune/shared,
// sans dependance runtime (spec 3.1 : moteur pur, zero dependance).
// Les validations Zod ont lieu aux frontieres (persistance, API, chroniqueur).

export type Age = "fire" | "steam" | "orbital" | "oblivion";

export interface Needs {
  food: number;
  energy: number;
  social: number;
}

export interface Character {
  id: string;
  kind: "figure" | "extra";
  name: string;
  gender: "f" | "m";
  ageYears: number;
  role: string;
  traits: string[];
  goal: string;
  homeId: string;
  workId: string;
  needs: Needs;
  pos: { c: number; r: number };
  state: "idle" | "walk" | "work" | "eat" | "sleep" | "talk";
  task: string | null;
  timer: number;
  memory: { summary: string; facts: string[] };
  quote: string | null;
}

export interface Building {
  id: string;
  type: "house" | "hall" | "market" | "site" | "field" | "forest";
  c: number;
  r: number;
  progress: number;
  capacity: number;
}

export interface Relation {
  a: string;
  b: string;
  type: "rival" | "friend" | "couple" | "mentor" | "neutral";
  value: number;
}

export interface Effect {
  target: "resources" | "relation" | "character" | "building";
  id?: string;
  field: string;
  delta: number;
  reason: string;
}

export interface RawEvent {
  tick: number;
  type: string;
  actors: string[];
  place: string;
  data?: Record<string, unknown>;
}

export interface WorldState {
  version: 1;
  seed: number;
  rng: number;
  day: number;
  tick: number;
  age: Age;
  name: string;
  map: { cols: number; rows: number; tiles: string };
  buildings: Building[];
  characters: Character[];
  resources: { food: number; wood: number; goods: number };
  relations: Relation[];
  pendingEffects: Effect[];
  playerAdds: string[];
  log: RawEvent[];
}
