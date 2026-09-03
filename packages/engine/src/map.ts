// Carte 20x14 et recherche de chemin A* (spec 5.2).
// Couts : chemin 0.5, herbe 1, autres 1.8. Eau et batiments infranchissables.
// 8 directions, pas de coupe de coin.

import type { Building, WorldState } from "./types.js";

export const TILE_WATER = "W";
export const TILE_SAND = "S";
export const TILE_FOREST = "F";
export const TILE_GRASS = ".";
export const TILE_FIELD = "~";
export const TILE_PATH = "P";

export function idx(cols: number, c: number, r: number): number {
  return r * cols + c;
}

export function getTile(map: { cols: number; rows: number; tiles: string }, c: number, r: number): string {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return TILE_WATER;
  return map.tiles[idx(map.cols, c, r)] ?? TILE_WATER;
}

export function tileCost(t: string): number {
  if (t === TILE_PATH) return 0.5;
  if (t === TILE_GRASS) return 1;
  return 1.8;
}

export function buildingAt(buildings: Building[], c: number, r: number): Building | undefined {
  return buildings.find((b) => b.c === c && b.r === r);
}

export function isBlocked(state: WorldState, c: number, r: number, forSiteWork = false): boolean {
  const t = getTile(state.map, c, r);
  if (t === TILE_WATER) return true;
  const b = buildingAt(state.buildings, c, r);
  if (!b) return false;
  // On peut se tenir sur un chantier pour y travailler, pas traverser les autres batiments.
  if (b.type === "site" && forSiteWork) return false;
  return true;
}

interface Node {
  c: number;
  r: number;
  g: number;
  f: number;
}

function heuristic(aC: number, aR: number, bC: number, bR: number): number {
  const dx = Math.abs(aC - bC);
  const dr = Math.abs(aR - bR);
  return Math.max(dx, dr) + 0.41 * Math.min(dx, dr);
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Prochain pas A* de (fc,fr) vers (tc,tr). Retourne la case suivante ou null si arrive/bloque. */
export function nextStep(
  state: WorldState,
  fc: number,
  fr: number,
  tc: number,
  tr: number,
): { c: number; r: number } | null {
  if (fc === tc && fr === tr) return null;
  const { cols, rows } = state.map;
  const key = (c: number, r: number): number => r * cols + c;
  const open: Node[] = [{ c: fc, r: fr, g: 0, f: heuristic(fc, fr, tc, tr) }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(fc, fr), 0]]);
  const closed = new Set<number>();
  const targetBlocked = isBlocked(state, tc, tr);
  // La cible est un batiment (case occupee) : on vise une case adjacente libre.
  // Tous les batiments se traitent pareil, chantier inclus : on travaille depuis la case voisine.
  const goals: { c: number; r: number }[] = [];
  if (!targetBlocked) {
    goals.push({ c: tc, r: tr });
  } else {
    for (const [dc, dr] of DIRS) {
      const nc = tc + dc;
      const nr = tr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (!isBlocked(state, nc, nr)) goals.push({ c: nc, r: nr });
    }
    if (goals.length === 0) return null;
  }
  const isGoal = (c: number, r: number): boolean => goals.some((g) => g.c === c && g.r === r);

  let found: { c: number; r: number } | null = null;
  let guard = 0;
  while (open.length > 0 && guard++ < 2000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i] as Node;
      const b = open[bi] as Node;
      if (a.f < b.f) bi = i;
    }
    const cur = open.splice(bi, 1)[0] as Node;
    if (isGoal(cur.c, cur.r)) {
      found = { c: cur.c, r: cur.r };
      // Reconstruire le premier pas
      let k = key(cur.c, cur.r);
      const path: number[] = [k];
      while (came.has(k)) {
        k = came.get(k) as number;
        path.push(k);
      }
      path.reverse();
      if (path.length < 2) return null;
      const step = path[1] as number;
      return { c: step % cols, r: Math.floor(step / cols) };
    }
    closed.add(key(cur.c, cur.r));
    for (const [dc, dr] of DIRS) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const diag = dc !== 0 && dr !== 0;
      if (diag) {
        if (isBlocked(state, cur.c + dc, cur.r) || isBlocked(state, cur.c, cur.r + dr)) continue;
      }
      if (isBlocked(state, nc, nr)) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      const stepCost = (diag ? 1.41 : 1) * tileCost(getTile(state.map, nc, nr));
      const g = cur.g + stepCost;
      if (gScore.has(nk) && (gScore.get(nk) as number) <= g) continue;
      gScore.set(nk, g);
      came.set(nk, key(cur.c, cur.r));
      const h = Math.min(...goals.map((gg) => heuristic(nc, nr, gg.c, gg.r)));
      const existing = open.find((n) => n.c === nc && n.r === nr);
      if (existing) {
        existing.g = g;
        existing.f = g + h;
      } else {
        open.push({ c: nc, r: nr, g, f: g + h });
      }
    }
  }
  return found ? null : null;
}

/** Distance de marche approximative (longueur A* bornee), pour logs et choix. */
export function pathLength(state: WorldState, fc: number, fr: number, tc: number, tr: number): number {
  let c = fc;
  let r = fr;
  for (let i = 0; i < 60; i++) {
    if (c === tc && r === tr) return i;
    const s = nextStep(state, c, r, tc, tr);
    if (!s) return i + 60;
    c = s.c;
    r = s.r;
  }
  return 60;
}
