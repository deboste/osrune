"use client";
// Carte iso HD : diorama vivant. Le moteur tourne en presentation (rien ne persiste).
// Props : etat serveur, derniers plans du film, selection.

import { useEffect, useRef } from "react";
import { runDay, tick, type Building, type Character, type WorldState } from "@osrune/engine";
import {
  BH,
  TH,
  TW,
  tileToWorld,
  worldSize,
  worldToScreen,
  type Camera,
} from "@/lib/iso/engine";
import { block, building, decor, nightShade, sunFor, tileSide, tileTop, type Fx as Bfx, type Sun } from "@/lib/iso/terrain";
import {
  drawBirds,
  drawClouds,
  drawFlies,
  drawSky,
  drawSmoke,
  grade,
  initFx,
  letterbox,
  stepFx,
  villager,
  type FxState,
} from "@/lib/iso/actors";

export interface FilmShot {
  lieu: string;
  texte: string;
}

interface Props {
  state: WorldState;
  film: FilmShot[] | null;
  onSelect: (c: Character | null) => void;
  onFilmEnd?: () => void;
  selectedId?: string | null;
}

function lieuPos(lieu: string, buildings: Building[]): { c: number; r: number } {
  const pick = (t: string): Building | undefined => buildings.find((b) => b.type === t);
  const b = pick(lieu) ?? pick("hall") ?? buildings[0];
  return b ? { c: b.c, r: b.r } : { c: 10, r: 7 };
}

export default function IsoMap({ state, film, onSelect, onFilmEnd, selectedId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<string | null>(selectedId ?? null);
  selRef.current = selectedId ?? null;
  const filmRef = useRef<FilmShot[] | null>(film);
  filmRef.current = film;
  const endRef = useRef<(() => void) | undefined>(onFilmEnd);
  endRef.current = onFilmEnd;
  const selCb = useRef(onSelect);
  selCb.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const live: WorldState = JSON.parse(JSON.stringify(state)) as WorldState;
    // Rejouer un peu pour animer des la premiere image (positions variees).
    for (let k = 0; k < 20; k++) tick(live);

    const cols = live.map.cols;
    const rows = live.map.rows;
    const bounds = worldSize(cols, rows);
    const isoW = ((cols + rows) * TW) / 2;
    const isoH = ((cols + rows) * TH) / 2;
    const centerX = 0;
    const centerY = isoH / 2;

    const cam: Camera = { x: centerX, y: centerY, zoom: 1 };
    const fx: FxState = initFx(isoW, isoH);
    const render = new Map<string, { x: number; y: number; phase: number }>();
    const tileCenter = (c: number, r: number): { x: number; y: number } => {
      const t = tileToWorld(c, r);
      return { x: t.x, y: t.y + TH / 2 };
    };
    for (const c of live.characters) {
      const p = tileCenter(c.pos.c, c.pos.r);
      render.set(c.id, { x: p.x, y: p.y, phase: Math.random() * 9 });
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let filmT = 0;
    let filmActive = false;
    let destroyed = false;

    const resize = (): { w: number; h: number } => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      return { w: rect.width, h: rect.height };
    };
    let { w: cssW, h: cssH } = resize();
    const fit = (): void => {
      cam.zoom = Math.max(0.35, Math.min(cssW / (isoW + 120), cssH / (isoH + 180), 1.2));
      cam.x = centerX;
      cam.y = centerY - 20;
    };
    fit();
    const onResize = (): void => {
      const s = resize();
      cssW = s.w;
      cssH = s.h;
    };
    window.addEventListener("resize", onResize);

    // Interaction : glisser = panoramique, molette = zoom, clic = fiche.
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
    const down = (e: PointerEvent): void => {
      drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent): void => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      cam.x = drag.cx - dx / cam.zoom;
      cam.y = drag.cy - dy / cam.zoom;
    };
    const up = (e: PointerEvent): void => {
      if (drag && !drag.moved) {
        // selection habitant
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let best: Character | null = null;
        let bestD = 22;
        for (const c of live.characters) {
          const rp = render.get(c.id);
          if (!rp) continue;
          const s = worldToScreen(rp, cam, cssW, cssH);
          const d = Math.hypot(s.x - mx, s.y - (my - 14));
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        selCb.current(best);
      }
      drag = null;
    };
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.9 : 1.1;
      cam.zoom = Math.max(0.35, Math.min(2.4, cam.zoom * f));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    const hourNow = (): number => {
      const d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    };

    const frame = (now: number): void => {
      if (destroyed) return;
      const dt = Math.min(80, now - last);
      last = now;
      const rect = canvas.getBoundingClientRect();
      if (rect.width !== cssW || rect.height !== cssH) {
        const s = resize();
        cssW = s.w;
        cssH = s.h;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sun: Sun = sunFor(reduced ? 10.5 : hourNow());
      drawSky(ctx, cssW, cssH, sun, reduced ? 10.5 : hourNow());

      // nuages (fond)
      ctx.save();
      drawClouds(ctx, fx, sun);
      ctx.restore();

      // moteur presentation : 1 tick ~650 ms (sans sauvegarde)
      if (!reduced) {
        acc += dt;
        if (acc > 650) {
          acc = 0;
          if (live.tick >= 47) {
            runDay(live);
          } else {
            tick(live);
          }
        }
        stepFx(fx, dt, cssW, cssH, sun.daylight);
      }

      // interpolation des positions
      for (const c of live.characters) {
        const rp = render.get(c.id);
        const tp = tileCenter(c.pos.c, c.pos.r);
        if (!rp) {
          render.set(c.id, { x: tp.x, y: tp.y, phase: Math.random() * 9 });
          continue;
        }
        const k = reduced ? 1 : 1 - Math.pow(0.0015, dt / 1000);
        rp.x += (tp.x - rp.x) * k;
        rp.y += (tp.y - rp.y) * k;
        rp.phase += (dt / 1000) * (Math.hypot(tp.x - rp.x, tp.y - rp.y) > 3 ? 9 : 2);
      }

      // camera film ou libre
      const shots = filmRef.current;
      let caption = "";
      if (shots && shots.length > 0 && !reduced) {
        filmActive = true;
        const per = 3000;
        const total = shots.length * per + 2500;
        filmT += dt;
        if (filmT >= total) {
          filmRef.current = null;
          filmActive = false;
          filmT = 0;
          endRef.current?.();
        } else if (filmT >= shots.length * per) {
          // plan large final
          const targetZoom = cssW / (isoW + 200) > 1 ? 1 : cssW / (isoW + 200);
          cam.zoom += (targetZoom - cam.zoom) * 0.04;
          cam.x += (centerX - cam.x) * 0.04;
          cam.y += (centerY - cam.y) * 0.04;
          caption = `${state.name} — jour ${state.day}`;
        } else {
          const idx = Math.floor(filmT / per);
          const shot = shots[idx] as FilmShot;
          const lp = lieuPos(shot.lieu, live.buildings);
          const tp = tileToWorld(lp.c, lp.r);
          const tx = tp.x;
          const ty = tp.y;
          cam.x += (tx - cam.x) * 0.06;
          cam.y += (ty - cam.y) * 0.06;
          cam.zoom += (2 - cam.zoom) * 0.05;
          caption = shot.texte;
        }
      } else if (filmActive) {
        filmActive = false;
        filmT = 0;
        fit();
      }

      // ---- scene monde ----
      ctx.save();
      const ox = cssW / 2 - cam.x * cam.zoom;
      const oy = cssH / 2 - cam.y * cam.zoom;
      ctx.translate(ox, oy);
      ctx.scale(cam.zoom, cam.zoom);

      // ombre portee de l'ile
      ctx.fillStyle = "rgba(10,20,30,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, isoH + BH + 26, isoW * 0.52, 40, 0, 0, 7);
      ctx.fill();

      interface Op {
        d: number;
        kind: "g" | "b" | "a";
        c: number;
        r: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o?: any;
      }
      const ops: Op[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) ops.push({ d: c + r, kind: "g", c, r });
      }
      for (const b of live.buildings) ops.push({ d: b.c + b.r + 0.3, kind: "b", c: b.c, r: b.r, o: b });
      for (const ch of live.characters) {
        ops.push({ d: ch.pos.c + ch.pos.r + 0.35, kind: "a", c: ch.pos.c, r: ch.pos.r, o: ch });
      }
      ops.sort((a, b) => a.d - b.d);

      const bfx: Bfx = { smoke: fx.smoke };
      for (const op of ops) {
        if (op.kind === "g") {
          const t = live.map.tiles[op.r * cols + op.c] ?? ".";
          const hgt = t === "W" ? 0 : 2 + (op.c * 7 + op.r * 13) % 3;
          block(ctx, op.c, op.r, tileTop(t, op.c, op.r), tileSide(t), hgt, t === "W");
          decor(ctx, t, op.c, op.r, reduced ? 0 : now, sun);
        } else if (op.kind === "b") {
          const b = op.o as Building;
          const p = tileToWorld(b.c, b.r);
          building(ctx, b, p.x, p.y + TH / 2, sun, reduced ? 0 : now, bfx);
        } else {
          const ch = op.o as Character;
          const rp = render.get(ch.id);
          if (!rp) continue;
          const moving = Math.hypot(tileCenter(ch.pos.c, ch.pos.r).x - rp.x, tileCenter(ch.pos.c, ch.pos.r).y - rp.y) > 3;
          villager(
            ctx,
            { c: ch, x: rp.x, y: rp.y, depth: 0, moving, phase: rp.phase },
            sun,
            reduced ? 0 : now,
            selRef.current === ch.id,
            true,
          );
        }
      }
      drawSmoke(ctx, fx);
      ctx.restore();

      // atmosphere ecran
      drawFlies(ctx, fx, reduced ? 0 : now, cssW, cssH, sun);
      drawBirds(ctx, fx);
      const n = nightShade(sun);
      if (n > 0.02) {
        ctx.fillStyle = `rgba(10,16,60,${n})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }
      // vignette douce
      const v = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.45, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(8,8,18,0.35)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, cssW, cssH);

      if (caption) letterbox(ctx, cssW, cssH, caption.length > 110 ? caption.slice(0, 110) + "…" : caption);

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      frame(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />;
}
