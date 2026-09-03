// Base iso : projection, camera, hash deterministe, couleurs.
// Vue diorama : les tuiles sont des blocs en relief, trie peintre par (r + c).

export const TW = 64; // largeur losange au zoom 1
export const TH = 32; // hauteur losange au zoom 1
export const BH = 14; // hauteur des flancs (relief)

export interface Camera {
  x: number; // centre monde en px monde
  y: number;
  zoom: number;
}

/** grille (c, r) -> monde (x, y), origine = sommet du losange. */
export function tileToWorld(c: number, r: number): { x: number; y: number } {
  return { x: ((c - r) * TW) / 2, y: ((c + r) * TH) / 2 };
}

export function worldSize(cols: number, rows: number): { w: number; h: number } {
  return { w: ((cols + rows) * TW) / 2, h: ((cols + rows) * TH) / 2 + BH + 120 };
}

/** monde -> ecran */
export function worldToScreen(p: { x: number; y: number }, cam: Camera, w: number, h: number): { x: number; y: number } {
  return { x: (p.x - cam.x) * cam.zoom + w / 2, y: (p.y - cam.y) * cam.zoom + h / 2 };
}

/** hash deterministe par tuile (decor varie sans_rng). */
export function hash2(c: number, r: number, salt: number): number {
  let h = (c * 374761393 + r * 668265263 + salt * 974634) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Assombrit/eclaircit une couleur hex. f < 1 assombrit, > 1 eclaircit. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Melange deux couleurs hex. t=0 -> a, t=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + (((pb >> 16) & 255) * t));
  const g = Math.round((((pa >> 8) & 255) * (1 - t) + (((pb >> 8) & 255) * t)));
  const bl = Math.round(((pa & 255) * (1 - t) + ((pb & 255) * t)));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

// Palette Age du Feu (diorama chaleureux)
export const PAL = {
  grass: ["#69b45c", "#61ad55", "#71bd60"],
  grassDry: "#8fbf5a",
  dirt: "#b98d55",
  dirtDark: "#8a6840",
  sand: "#ead9a0",
  water: "#3fa7d6",
  waterDeep: "#2b7fb8",
  field: "#9c7a45",
  crop: "#7fae4e",
  path: "#cbb37e",
  wood: "#7a5230",
  woodDark: "#5d3f24",
  thatch: "#d9a84e",
  thatchDark: "#b3853a",
  wall: "#e8dcc3",
  wallShade: "#c9b896",
  timber: "#6b4a2c",
  roofRed: "#b6503c",
  stone: "#9a9a92",
  leaf: "#3e8e4f",
  leafDark: "#2f703d",
  trunk: "#6b4a2c",
};
