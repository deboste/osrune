// Villageois plats animes : corps module (jambes, tunique de metier, bras+outil,
// tete, cheveux), etats idle/walk/work/talk/eat/sleep, etiquettes et bulles.

import { hashStr, mix, shade } from "./engine";
import type { Character } from "@osrune/engine";
import type { Sun } from "./terrain.js";

type Ctx = CanvasRenderingContext2D;

const ROLE_COLOR: Record<string, string> = {
  tisserande: "#8e5aa8",
  forgeron: "#5a5a60",
  meuniere: "#d9c06a",
  bucheron: "#4e7a3a",
  potier: "#b5653a",
  berger: "#7a9e7e",
  aide: "#7a8a99",
  porteuse: "#a87f4e",
  garde: "#8a3a3a",
  cueilleur: "#5a9e6a",
};

const SKIN = ["#f2c89b", "#e0ac7e", "#c98d5f", "#8a5a3a"];
const HAIR = ["#3a2a1a", "#6b4a2c", "#b3742e", "#8a8a8a", "#d9d9d9", "#a83a2e"];

export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? "#7a8a99";
}

export interface ActorLook {
  skin: string;
  hair: string;
  hairStyle: number;
  tunic: string;
}

export function lookOf(c: Character): ActorLook {
  const h = hashStr(c.id + c.name);
  const h2 = hashStr(c.name + c.role);
  return {
    skin: SKIN[Math.floor(h * SKIN.length) % SKIN.length] as string,
    hair: HAIR[Math.floor(h2 * HAIR.length) % HAIR.length] as string,
    hairStyle: Math.floor(hashStr(c.id + "h") * 4),
    tunic: roleColor(c.role),
  };
}

export interface RenderActor {
  c: Character;
  x: number; // monde, interpole
  y: number;
  depth: number;
  moving: boolean;
  phase: number;
}

/** Dessine un villageois en (x, y) monde = pieds. Echelle ~42px de haut. */
export function villager(
  ctx: Ctx,
  a: RenderActor,
  sun: Sun,
  time: number,
  selected: boolean,
  showLabel: boolean,
): void {
  const { c } = a;
  const look = lookOf(c);
  const walk = a.moving;
  const working = c.state === "work";
  const talking = c.state === "talk";
  const sleeping = c.state === "sleep";
  const bob = walk ? Math.abs(Math.sin(a.phase)) * 2.4 : Math.sin(time * 0.002 + a.phase) * 0.9;
  const y0 = a.y - bob;
  const flip = walk ? (Math.cos(a.phase) >= 0 ? 1 : -1) : 1;

  // ombre
  ctx.fillStyle = `rgba(20,30,20,${0.2 - sun.daylight * 0.05})`;
  ctx.beginPath();
  ctx.ellipse(a.x + sun.dirX * 3, a.y + 1, 8, 3.2, 0, 0, 7);
  ctx.fill();

  if (sleeping) {
    // assis, "Z"
    ctx.fillStyle = look.tunic;
    ctx.beginPath();
    ctx.ellipse(a.x, a.y - 6, 8, 6, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(a.x + 2, a.y - 13, 5.4, 0, 7);
    ctx.fill();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(a.x + 1, a.y - 14.5, 5.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#5a6a8a";
    ctx.font = "bold 10px system-ui";
    const zo = (time * 0.001 + a.phase) % 2;
    ctx.fillText("z", a.x + 8, a.y - 18 - zo * 8);
    if (zo > 1) ctx.fillText("z", a.x + 13, a.y - 26 - (zo - 1) * 8);
    if (selected) ring(ctx, a.x, a.y);
    return;
  }

  const legSwing = walk ? Math.sin(a.phase) * 4.4 : 0;
  const bend = working ? 3 : 0;
  // jambes
  ctx.fillStyle = "#4a3a2c";
  ctx.fillRect(a.x - 4.4, y0 - 12, 3.6, 12 + Math.max(0, legSwing * 0.4));
  ctx.fillRect(a.x + 0.8, y0 - 12, 3.6, 12 + Math.max(0, -legSwing * 0.4));
  // tunique (trapeze)
  ctx.fillStyle = look.tunic;
  ctx.beginPath();
  ctx.moveTo(a.x - 5.4, y0 - 11);
  ctx.lineTo(a.x + 5.4, y0 - 11);
  ctx.lineTo(a.x + 7.4, y0 - 24 + bend);
  ctx.lineTo(a.x - 7.4, y0 - 24 + bend);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(look.tunic, 0.78);
  ctx.fillRect(a.x - 7.4, y0 - 15 + bend * 0.4, 4.6, 4);
  // ceinture
  ctx.fillStyle = "#3a2c1e";
  ctx.fillRect(a.x - 6.4, y0 - 14.5 + bend * 0.5, 12.8, 2.4);
  // bras arriere
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const armSwing = walk ? -Math.sin(a.phase) * 4 : 0;
  ctx.beginPath();
  ctx.moveTo(a.x - 6, y0 - 22 + bend);
  ctx.lineTo(a.x - 8.5, y0 - 14 + armSwing * 0.4);
  ctx.stroke();

  const hx = a.x + flip * 1.5;
  const hy = y0 - 30 + bend * 0.7;
  // tete
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, 7);
  ctx.fill();
  // cheveux selon style
  ctx.fillStyle = look.hair;
  if (look.hairStyle === 0) {
    ctx.beginPath();
    ctx.arc(hx - flip, hy - 1.6, 6.1, Math.PI * 0.9, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(hx - 7.5, hy - 3, 3, 9); // natte
  } else if (look.hairStyle === 1) {
    ctx.beginPath();
    ctx.arc(hx, hy - 1, 6.2, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(hx - 6.2, hy - 2, 12.4, 3.4); // coupe au bol
  } else if (look.hairStyle === 2) {
    // capuche
    ctx.fillStyle = shade(look.tunic, 0.7);
    ctx.beginPath();
    ctx.arc(hx, hy - 0.6, 7.6, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(hx + flip * 2, hy - 3.4, 3.4, 0, 7);
    ctx.fill(); // chignon
    ctx.beginPath();
    ctx.arc(hx - flip, hy - 1.6, 6, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  }
  // oeil de profil
  ctx.fillStyle = "#2a2018";
  ctx.beginPath();
  ctx.arc(hx + flip * 3.4, hy + 0.4, 1, 0, 7);
  ctx.fill();

  // bras avant + outil de metier
  const toolSwing = working ? Math.sin(time * 0.02 + a.phase) * 5 : walk ? Math.sin(a.phase) * 4 : 0;
  const ax = a.x + 6;
  const ay = y0 - 22 + bend;
  ctx.strokeStyle = look.skin;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + 2.5, ay + 8 + toolSwing * 0.4);
  ctx.stroke();
  drawTool(ctx, c, ax + 2.5, ay + 8 + toolSwing * 0.4, toolSwing, time);

  if (talking) {
    // ondes de parole
    ctx.strokeStyle = "rgba(60,60,70,0.6)";
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 2; k++) {
      const rr = 9 + ((time * 0.02 + a.phase + k * 0.5) % 1) * 8;
      ctx.globalAlpha = 0.7 - ((time * 0.02 + a.phase + k * 0.5) % 1) * 0.6;
      ctx.beginPath();
      ctx.arc(hx + flip * 6, hy - 2, rr, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // bulle de replique (figures)
  if (c.quote && (talking || showLabel)) {
    bubble(ctx, hx, hy - 26, c.quote);
  }
  if (showLabel && c.kind === "figure") {
    label(ctx, hx, hy - (c.quote && talking ? 52 : 16), c.name, c.id === (selected as unknown as string) || selected);
  }
  if (selected) ring(ctx, a.x, a.y);
}

function drawTool(ctx: Ctx, c: Character, x: number, y: number, swing: number, time: number): void {
  void time;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5 + swing * 0.06);
  if (c.role === "forgeron" || c.role === "bucheron") {
    ctx.strokeStyle = "#6b4a2c";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -11);
    ctx.stroke();
    ctx.fillStyle = c.role === "forgeron" ? "#777" : "#999";
    ctx.fillRect(-4.5, -15, 9, 5);
  } else if (c.role === "tisserande" || c.role === "meuniere" || c.role === "potier") {
    ctx.fillStyle = "#a8763e";
    ctx.beginPath();
    ctx.ellipse(0, -3, 5.4, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = c.role === "potier" ? "#b5653a" : "#e8d9b0";
    ctx.beginPath();
    ctx.ellipse(0, -5, 3.4, 2.4, 0, 0, 7);
    ctx.fill();
  } else {
    // fourche / baton
    ctx.strokeStyle = "#6b4a2c";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -13);
    ctx.moveTo(0, -13);
    ctx.lineTo(-3.4, -17);
    ctx.moveTo(0, -13);
    ctx.lineTo(3.4, -17);
    ctx.stroke();
  }
  ctx.restore();
}

function ring(ctx: Ctx, x: number, y: number): void {
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 13, 5.4, 0, 0, 7);
  ctx.stroke();
}

function label(ctx: Ctx, x: number, y: number, name: string, _sel: boolean): void {
  void _sel;
  ctx.font = "600 10px system-ui";
  const w = ctx.measureText(name).width + 12;
  ctx.fillStyle = "rgba(20,24,30,0.72)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 9, w, 17, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(name, x, y + 3.5);
  ctx.textAlign = "left";
}

export function bubble(ctx: Ctx, x: number, y: number, text: string): void {
  ctx.font = "12px system-ui";
  const w = Math.min(190, ctx.measureText(text).width + 16);
  const h = 24;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.strokeStyle = "rgba(40,40,50,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 7);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.fillStyle = "#33333d";
  ctx.textAlign = "center";
  ctx.fillText(text.length > 30 ? text.slice(0, 30) + "…" : text, x, y - h + 16);
  ctx.textAlign = "left";
}

// ---------- Effets atmospheriques ----------

export interface FxState {
  smoke: { x: number; y: number; r: number; a: number }[];
  flies: { x: number; y: number; p: number }[];
  clouds: { x: number; y: number; s: number; v: number }[];
  birds: { x: number; y: number; v: number; p: number }[];
}

export function initFx(seedW: number, seedH: number): FxState {
  const clouds = [];
  for (let k = 0; k < 4; k++) {
    clouds.push({ x: (k * 0.27 + 0.05) * seedW, y: (0.08 + (k % 3) * 0.09) * seedH, s: 60 + (k % 3) * 26, v: 4 + k * 1.4 });
  }
  const flies = [];
  for (let k = 0; k < 26; k++) flies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9 });
  const birds: FxState["birds"] = [];
  return { smoke: [], flies, clouds, birds };
}

export function stepFx(fx: FxState, dt: number, w: number, h: number, daylight: number): void {
  for (const s of fx.smoke) {
    s.y -= dt * 0.028;
    s.x += Math.sin(s.y * 0.05) * dt * 0.008 + dt * 0.004;
    s.r += dt * 0.004;
    s.a -= dt * 0.00045;
  }
  fx.smoke = fx.smoke.filter((s) => s.a > 0);
  for (const c of fx.clouds) {
    c.x += (c.v * dt) / 1000;
    if (c.x - c.s * 2 > w) c.x = -c.s * 2;
  }
  if (daylight > 0.5 && Math.random() < dt * 0.00012 && fx.birds.length < 3) {
    fx.birds.push({ x: -40, y: h * (0.1 + Math.random() * 0.2), v: 40 + Math.random() * 30, p: Math.random() * 9 });
  }
  for (const b of fx.birds) {
    b.x += (b.v * dt) / 1000;
    b.p += dt * 0.008;
  }
  fx.birds = fx.birds.filter((b) => b.x < w + 60);
  void h;
}

export function drawSky(ctx: Ctx, w: number, h: number, sun: Sun, hour: number): void {
  const dl = sun.daylight;
  const top = mix("#0b1026", "#7ec8e8", dl);
  const mid = mix("#131a35", "#bfe3ef", dl);
  const warm = sun.dusk * dl;
  const horizon = mix(mid, "#f2a65e", Math.min(1, warm * 1.2));
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (dl < 0.25) {
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - dl * 4)})`;
    for (let k = 0; k < 70; k++) {
      const sx = ((k * 197.3) % 1) * w;
      const sy = ((k * 331.7) % 1) * h * 0.6;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(hour + k));
      ctx.globalAlpha = tw * (1 - dl * 4);
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  // collines lointaines (2 strates)
  for (const [par, col, base] of [[0.16, mix("#1c2440", "#8fc3a8", dl), 0.62], [0.3, mix("#232c4c", "#a8d4b5", dl), 0.7]] as [
    number,
    string,
    number,
  ][]) {
    void par;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h * base);
    for (let x = 0; x <= w; x += 24) {
      ctx.lineTo(x, h * base - Math.sin(x * 0.008 + base * 9) * 26 - Math.sin(x * 0.02) * 8);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawClouds(ctx: Ctx, fx: FxState, sun: Sun): void {
  for (const c of fx.clouds) {
    ctx.fillStyle = sun.daylight > 0.4 ? "rgba(255,255,255,0.85)" : "rgba(40,46,70,0.85)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.s, c.s * 0.32, 0, 0, 7);
    ctx.ellipse(c.x - c.s * 0.5, c.y + 6, c.s * 0.55, c.s * 0.22, 0, 0, 7);
    ctx.ellipse(c.x + c.s * 0.5, c.y + 7, c.s * 0.6, c.s * 0.24, 0, 0, 7);
    ctx.fill();
  }
}

export function drawSmoke(ctx: Ctx, fx: FxState): void {
  for (const s of fx.smoke) {
    ctx.fillStyle = `rgba(200,200,205,${Math.max(0, s.a)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 7);
    ctx.fill();
  }
}

export function drawFlies(ctx: Ctx, fx: FxState, time: number, w: number, h: number, sun: Sun): void {
  if (sun.daylight > 0.4) return;
  ctx.fillStyle = "#ffe28a";
  for (const f of fx.flies) {
    const x = ((f.x + time * 0.000008 * (1 + f.p)) % 1) * w;
    const y = ((f.y + Math.sin(time * 0.001 + f.p) * 0.02) % 1) * h;
    const glow = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.004 + f.p * 3));
    ctx.globalAlpha = glow * 0.9;
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawBirds(ctx: Ctx, fx: FxState): void {
  ctx.strokeStyle = "rgba(40,45,60,0.7)";
  ctx.lineWidth = 1.8;
  for (const b of fx.birds) {
    const wv = Math.sin(b.p) * 4;
    ctx.beginPath();
    ctx.moveTo(b.x - 7, b.y);
    ctx.quadraticCurveTo(b.x - 2, b.y - 3 - wv, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 2, b.y - 3 - wv, b.x + 7, b.y);
    ctx.stroke();
  }
}

export function grade(ctx: Ctx, w: number, h: number, sun: Sun): void {
  // nuit bleutee + vignette
  const n = (1 - sun.daylight) * 0.5;
  if (n > 0.02) {
    ctx.fillStyle = `rgba(10,16,60,${n})`;
    ctx.fillRect(0, 0, w, h);
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(8,8,18,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

export function letterbox(ctx: Ctx, w: number, h: number, caption: string): void {
  const bh = h * 0.09;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, bh);
  ctx.fillRect(0, h - bh, w, bh);
  ctx.fillStyle = "#fff";
  ctx.font = "500 15px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(caption, w / 2, h - bh / 2 + 5);
  ctx.textAlign = "left";
}

export { mix };
