// Decor diorama : blocs de terrain en relief, batiments plats ombres.
// Style "flat HD" coherent : aplats + ombrage directionnel + textures sobres.

import { BH, PAL, TH, TW, hash2, mix, shade, tileToWorld } from "./engine";
import type { Building } from "@osrune/engine";

export interface Sun {
  daylight: number; // 0 nuit .. 1 plein jour
  dusk: number; // 0..1 pres du lever/coucher
  dirX: number; // direction ombres (-1..1)
}

export function sunFor(hour: number): Sun {
  // Lever 6h30, coucher 20h30 (douceur boreale).
  const rise = 6.5;
  const set = 20.5;
  let daylight: number;
  if (hour <= rise || hour >= set) daylight = 0;
  else if (hour < rise + 1.5) daylight = (hour - rise) / 1.5;
  else if (hour > set - 1.5) daylight = (set - hour) / 1.5;
  else daylight = 1;
  daylight = Math.max(0, Math.min(1, daylight));
  const dusk = Math.max(0, 1 - Math.abs(hour - rise) * 1.2) + Math.max(0, 1 - Math.abs(hour - set) * 1.2);
  const t = (hour - rise) / (set - rise);
  return { daylight, dusk: Math.min(1, dusk), dirX: Math.cos(Math.min(1, Math.max(0, t)) * Math.PI) };
}

/** Grade lumineuse globale selon le soleil. Retourne l'assombrissement nuit 0..0.55. */
export function nightShade(sun: Sun): number {
  return (1 - sun.daylight) * 0.55;
}

type Ctx = CanvasRenderingContext2D;

function diamond(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.closePath();
}

/** Bloc de relief : flancs terre + plateau colore. hgt = surplomb (0 = eau). */
export function block(ctx: Ctx, c: number, r: number, top: string, side: string, hgt: number, water = false): void {
  const { x, y } = tileToWorld(c, r);
  const w = TW;
  const h = TH;
  const yy = y - hgt;
  if (water) {
    diamond(ctx, x, yy, w, h);
    ctx.fillStyle = top;
    ctx.fill();
    return;
  }
  // flanc gauche (plus sombre) puis droit
  ctx.fillStyle = shade(side, 0.72);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, yy + h / 2);
  ctx.lineTo(x, yy + h);
  ctx.lineTo(x, yy + h + BH);
  ctx.lineTo(x - w / 2, yy + h / 2 + BH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(side, 0.9);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, yy + h / 2);
  ctx.lineTo(x, yy + h);
  ctx.lineTo(x, yy + h + BH);
  ctx.lineTo(x + w / 2, yy + h / 2 + BH);
  ctx.closePath();
  ctx.fill();
  diamond(ctx, x, yy, w, h);
  ctx.fillStyle = top;
  ctx.fill();
  // filet de lumiere sur l'arete haute
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 2, yy + h / 2);
  ctx.lineTo(x, yy + 1);
  ctx.lineTo(x + w / 2 - 2, yy + h / 2);
  ctx.stroke();
}

function tuft(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y);
  ctx.quadraticCurveTo(x - s * 0.35, y - s * 0.6, x - s * 0.15, y - s * 0.8);
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x, y - s * 0.7, x + s * 0.05, y - s * 0.95);
  ctx.moveTo(x + s * 0.3, y);
  ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.2, y - s * 0.75);
  ctx.stroke();
}

/** Couleur de plateau par tuile moteur. */
export function tileTop(t: string, c: number, r: number): string {
  const h = hash2(c, r, 7);
  if (t === "W") return h > 0.5 ? PAL.water : PAL.waterDeep;
  if (t === "S") return PAL.sand;
  if (t === "F") return PAL.grass[1] as string;
  if (t === "~") return PAL.field;
  if (t === "P") return PAL.path;
  return (PAL.grass[Math.floor(h * 3) % 3] ?? PAL.grass[0]) as string;
}

export function tileSide(t: string): string {
  if (t === "S" || t === "P") return PAL.dirt;
  if (t === "~") return "#7d5f36";
  return PAL.dirtDark;
}

/** Decor pose sur le plateau (touffes, fleurs, cailloux, roseaux, cultures, pins). */
export function decor(ctx: Ctx, t: string, c: number, r: number, time: number, sun: Sun): void {
  const { x, y } = tileToWorld(c, r);
  const cx = x;
  const cy = y + TH / 2;
  if (t === ".") {
    const n = 1 + Math.floor(hash2(c, r, 11) * 3);
    for (let k = 0; k < n; k++) {
      const px = cx + (hash2(c, r, 20 + k) - 0.5) * TW * 0.55;
      const py = cy + (hash2(c, r, 30 + k) - 0.5) * TH * 0.5;
      tuft(ctx, px, py, 7 + hash2(c, r, 40 + k) * 5, shade(PAL.leafDark, 0.9 + hash2(c, r, 50 + k) * 0.3));
    }
    if (hash2(c, r, 60) > 0.86) {
      ctx.fillStyle = hash2(c, r, 61) > 0.5 ? "#e86a6a" : "#f2e394";
      ctx.beginPath();
      ctx.arc(cx + (hash2(c, r, 62) - 0.5) * 20, cy - 4, 2.2, 0, 7);
      ctx.fill();
    }
  } else if (t === "~") {
    // rangs de cultures onduleux
    ctx.strokeStyle = PAL.crop;
    ctx.lineWidth = 2.4;
    for (let row = -1; row <= 1; row++) {
      ctx.beginPath();
      for (let s = -3; s <= 3; s++) {
        const px = cx + s * 8;
        const py = cy + row * 7 + Math.sin(time * 0.001 + s + c + r) * 1.2;
        if (s === -3) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (t === "P") {
    if (hash2(c, r, 70) > 0.6) {
      ctx.fillStyle = shade(PAL.path, 0.82);
      ctx.beginPath();
      ctx.ellipse(cx + (hash2(c, r, 71) - 0.5) * 24, cy + (hash2(c, r, 72) - 0.5) * 8, 3.4, 2, 0.5, 0, 7);
      ctx.fill();
    }
  } else if (t === "W") {
    // scintillement
    const p = (time * 0.0006 + hash2(c, r, 80)) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(p * 6.28)})`;
    ctx.lineWidth = 1.6;
    const sx = cx + (hash2(c, r, 81) - 0.5) * 30;
    ctx.beginPath();
    ctx.moveTo(sx - 8, cy);
    ctx.quadraticCurveTo(sx, cy - 3, sx + 8, cy);
    ctx.stroke();
  } else if (t === "F") {
    pine(ctx, cx - 10, cy - 2, 1 + hash2(c, r, 90) * 0.3, sun);
    if (hash2(c, r, 91) > 0.45) pine(ctx, cx + 12, cy + 2, 0.75 + hash2(c, r, 92) * 0.25, sun);
  } else if (t === "S") {
    if (hash2(c, r, 93) > 0.5) tuft(ctx, cx, cy, 6, "#c9b06a");
  }
  void sun;
}

export function pine(ctx: Ctx, x: number, y: number, s: number, sun: Sun): void {
  void sun;
  ctx.fillStyle = PAL.trunk;
  ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
  const layers: [number, number, number][] = [
    [0, -10, 15],
    [0, -20, 12],
    [0, -29, 9],
  ];
  for (const [dx, dy, w] of layers) {
    ctx.fillStyle = PAL.leafDark;
    ctx.beginPath();
    ctx.moveTo(x + dx - w * s, y + dy * s);
    ctx.lineTo(x + dx, y + (dy - 12) * s);
    ctx.lineTo(x + dx + w * s, y + dy * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.leaf;
    ctx.beginPath();
    ctx.moveTo(x + dx - w * s * 0.55, y + dy * s);
    ctx.lineTo(x + dx, y + (dy - 12) * s);
    ctx.lineTo(x + dx + w * s * 0.1, y + dy * s);
    ctx.closePath();
    ctx.fill();
  }
  // ombre douce
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 3 * s, y + 1, 9 * s, 3.4 * s, 0, 0, 7);
  ctx.fill();
}

// ---------- Batiments ----------

function shadow(ctx: Ctx, x: number, y: number, w: number, sun: Sun): void {
  ctx.fillStyle = `rgba(20,30,20,${0.22 - sun.daylight * 0.06})`;
  ctx.beginPath();
  ctx.ellipse(x + sun.dirX * 7, y, w, w * 0.32, 0, 0, 7);
  ctx.fill();
}

/** Corps de maison : prisme + colombages. w en px monde. Retourne le haut du mur. */
function houseBody(ctx: Ctx, x: number, y: number, w: number, h: number, wall: string, sun: Sun): number {
  shadow(ctx, x, y, w * 0.62, sun);
  // face avant (sud-est, claire) et face gauche (ombreuse)
  ctx.fillStyle = shade(wall, 0.82);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * 0.42);
  ctx.lineTo(x, y - h * 0.62);
  ctx.lineTo(x, y);
  ctx.lineTo(x - w / 2, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h * 0.42);
  ctx.lineTo(x, y - h * 0.62);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w / 2, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // colombages
  ctx.strokeStyle = PAL.timber;
  ctx.lineWidth = 2;
  for (const fx of [-0.3, 0, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 2) * fx, y - h * 0.62 + Math.abs(fx) * h * 0.2);
    ctx.lineTo(x + (w / 2) * fx, y + (fx >= 0 ? 0 : h * 0.1));
    ctx.stroke();
  }
  return y - h * 0.62;
}

/** Toit de chaume a deux pans. */
function thatchRoof(ctx: Ctx, x: number, topY: number, w: number, h: number, sun: Sun): void {
  void sun;
  const over = w * 0.12;
  // pan gauche (sombre)
  ctx.fillStyle = PAL.thatchDark;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - over, topY + h * 0.28);
  ctx.lineTo(x, topY - h * 0.5);
  ctx.lineTo(x, topY + h * 0.1);
  ctx.lineTo(x - w / 2 - over, topY + h * 0.72);
  ctx.closePath();
  ctx.fill();
  // pan droit (clair)
  ctx.fillStyle = PAL.thatch;
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + over, topY + h * 0.28);
  ctx.lineTo(x, topY - h * 0.5);
  ctx.lineTo(x, topY + h * 0.1);
  ctx.lineTo(x + w / 2 + over, topY + h * 0.72);
  ctx.closePath();
  ctx.fill();
  // strates de chaume
  ctx.strokeStyle = "rgba(120,80,20,0.35)";
  ctx.lineWidth = 1.2;
  for (let k = 1; k <= 3; k++) {
    const yy = topY - h * 0.5 + (h * 0.6 * k) / 3.4;
    const ww = ((w / 2 + over) * k) / 3.4;
    ctx.beginPath();
    ctx.moveTo(x - ww, yy + h * 0.12);
    ctx.quadraticCurveTo(x, yy - h * 0.06, x + ww, yy + h * 0.12);
    ctx.stroke();
  }
  // faite
  ctx.strokeStyle = shade(PAL.thatchDark, 0.85);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, topY - h * 0.52);
  ctx.lineTo(x + w * 0.08, topY - h * 0.52);
  ctx.stroke();
}

function doorWindow(ctx: Ctx, x: number, y: number, sun: Sun, lit: boolean): void {
  // porte
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(x - 5, y - 16, 10, 16);
  ctx.fillStyle = lit ? "#ffca7a" : "#3a2a1a";
  ctx.fillRect(x - 3.4, y - 13, 6.8, 10);
  if (lit) {
    ctx.fillStyle = "rgba(255,180,90,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 12, 5, 0, 0, 7);
    ctx.fill();
  }
  // fenetre ronde
  ctx.fillStyle = PAL.timber;
  ctx.beginPath();
  ctx.arc(x + 14, y - 10, 4.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = lit ? "#ffd98f" : "#2c3844";
  ctx.beginPath();
  ctx.arc(x + 14, y - 10, 2.8, 0, 7);
  ctx.fill();
  void sun;
}

function chimney(ctx: Ctx, x: number, y: number, withSmoke: boolean, time: number, smoke: { x: number; y: number; r: number; a: number }[]): void {
  ctx.fillStyle = PAL.stone;
  ctx.fillRect(x, y - 26, 8, 26);
  ctx.fillStyle = shade(PAL.stone, 0.8);
  ctx.fillRect(x, y - 26, 3, 26);
  if (withSmoke && Math.floor(time / 350) % 2 === 0 && smoke.length < 40) {
    smoke.push({ x: x + 4, y: y - 28, r: 2.4, a: 0.5 });
  }
}

export interface Fx {
  smoke: { x: number; y: number; r: number; a: number }[];
}

/** Dessine un batiment. base = point d'ancrage (centre bas de la tuile). */
export function building(
  ctx: Ctx,
  b: Building,
  baseX: number,
  baseY: number,
  sun: Sun,
  time: number,
  fx: Fx,
): void {
  const night = sun.daylight < 0.45;
  if (b.type === "house") {
    const topY = houseBody(ctx, baseX, baseY, 52, 44, PAL.wall, sun);
    thatchRoof(ctx, baseX, topY, 52, 40, sun);
    doorWindow(ctx, baseX - 4, baseY - 2, sun, night);
    chimney(ctx, baseX + 14, topY - 6, true, time, fx.smoke);
  } else if (b.type === "hall") {
    const topY = houseBody(ctx, baseX, baseY, 84, 52, mix(PAL.wall, "#d8c49a", 0.5), sun);
    thatchRoof(ctx, baseX, topY, 84, 52, sun);
    // porte monumentale + brasier
    ctx.fillStyle = "#2c1e10";
    ctx.fillRect(baseX - 9, baseY - 24, 18, 24);
    const flick = 0.7 + 0.3 * Math.sin(time * 0.012) * Math.sin(time * 0.007 + 1);
    ctx.fillStyle = `rgba(255,${140 + Math.floor(40 * flick)},60,${0.75 * flick + 0.2})`;
    ctx.fillRect(baseX - 6, baseY - 20, 12, 20);
    ctx.fillStyle = "rgba(255,150,60,0.2)";
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + 2, 20, 7, 0, 0, 7);
    ctx.fill();
    // bannieres
    for (const bx of [-30, 30]) {
      ctx.fillStyle = "#a83a2e";
      ctx.fillRect(baseX + bx, topY - 34, 5, 22);
      ctx.fillStyle = "#e8d9b0";
      ctx.fillRect(baseX + bx, topY - 30, 5, 4);
    }
    chimney(ctx, baseX + 26, topY - 8, true, time, fx.smoke);
  } else if (b.type === "market") {
    shadow(ctx, baseX, baseY, 30, sun);
    // 4 poteaux + auvent raye
    ctx.fillStyle = PAL.timber;
    for (const [px, py] of [[-22, -6], [22, -6], [-22, 10], [22, 10]] as [number, number][]) {
      ctx.fillRect(baseX + px - 2, baseY - 34 + py * 0.4, 4, 30);
    }
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 === 0 ? "#c9563c" : "#efe3c8";
      const x0 = baseX - 28 + k * 9.4;
      ctx.beginPath();
      ctx.moveTo(x0, baseY - 38);
      ctx.lineTo(x0 + 9.4, baseY - 38);
      ctx.lineTo(x0 + 7, baseY - 26);
      ctx.lineTo(x0 - 2.4, baseY - 26);
      ctx.closePath();
      ctx.fill();
    }
    // etal : cageots
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(baseX - 18, baseY - 14, 36, 10);
    const goods: [number, string][] = [[-12, "#c9563c"], [-4, "#e8a13c"], [4, "#7fae4e"], [12, "#d9c06a"]];
    for (const [gx, gc] of goods) {
      ctx.fillStyle = gc;
      ctx.beginPath();
      ctx.arc(baseX + gx, baseY - 17, 4.4, 0, 7);
      ctx.fill();
    }
    // brasier du marche (le feu ne s'eteint jamais)
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(baseX + 30, baseY - 10, 7, 10);
    const fl = 0.6 + 0.4 * Math.abs(Math.sin(time * 0.01 + 2));
    ctx.fillStyle = `rgba(255,${120 + Math.floor(60 * fl)},40,0.9)`;
    ctx.beginPath();
    ctx.moveTo(baseX + 33.5, baseY - 22 - 6 * fl);
    ctx.quadraticCurveTo(baseX + 38, baseY - 14, baseX + 33.5, baseY - 10);
    ctx.quadraticCurveTo(baseX + 29, baseY - 14, baseX + 33.5, baseY - 22 - 6 * fl);
    ctx.fill();
  } else if (b.type === "site") {
    const p = Math.max(4, b.progress);
    shadow(ctx, baseX, baseY, 26, sun);
    // echafaudages
    ctx.strokeStyle = "#8a6a45";
    ctx.lineWidth = 2.4;
    const hgt = 10 + (p / 100) * 34;
    for (const px of [-20, -7, 7, 20]) {
      ctx.beginPath();
      ctx.moveTo(baseX + px, baseY);
      ctx.lineTo(baseX + px, baseY - hgt - 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(baseX - 22, baseY - hgt * 0.55);
    ctx.lineTo(baseX + 22, baseY - hgt * 0.55);
    ctx.stroke();
    // murs en cours
    ctx.fillStyle = mix("#b9a888", PAL.wall, p / 100);
    ctx.fillRect(baseX - 18, baseY - hgt * 0.55, 36, hgt * 0.55);
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 1.6;
    for (const px of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.moveTo(baseX + px, baseY - hgt * 0.55);
      ctx.lineTo(baseX + px, baseY);
      ctx.stroke();
    }
    // tas de planches
    ctx.fillStyle = PAL.wood;
    for (let k = 0; k < 3; k++) ctx.fillRect(baseX + 22, baseY - 4 - k * 4, 16 - k * 2, 3.4);
    if (p >= 100) {
      thatchRoof(ctx, baseX, baseY - hgt * 0.55 - 22, 48, 34, sun);
    }
  } else if (b.type === "field") {
    // epouvantail + cloture d'angle
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY - 4);
    ctx.lineTo(baseX, baseY - 26);
    ctx.moveTo(baseX - 8, baseY - 20);
    ctx.lineTo(baseX + 8, baseY - 20);
    ctx.stroke();
    ctx.fillStyle = "#c9563c";
    ctx.fillRect(baseX - 8, baseY - 26, 16, 9);
    ctx.fillStyle = "#e8c98f";
    ctx.beginPath();
    ctx.arc(baseX, baseY - 28, 4.6, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#8a6a45";
    ctx.fillRect(baseX - 5, baseY - 34, 10, 3);
  } else if (b.type === "forest") {
    pine(ctx, baseX - 12, baseY - 2, 1.5, sun);
    pine(ctx, baseX + 10, baseY, 1.1, sun);
    pine(ctx, baseX + 1, baseY - 8, 0.8, sun);
  }
}
