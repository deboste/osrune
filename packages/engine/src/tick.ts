// Moteur : tick, journee, besoins, deplacements, conversations, chantier.
// Deterministe : tout alea passe par state.rng (mulberry32).
// Hysteresis : seuils d'arret differents des seuils de declenchement.

import type { Building, Character, RawEvent, WorldState } from "./types.js";
import { nextRng } from "./rng.js";
import { DAY_TICKS, MAX_RAW_EVENTS } from "./constants.js";
import { nextStep } from "./map.js";
import { applyPendingEffects } from "./effects.js";

function rand(state: WorldState): number {
  const r = nextRng(state.rng);
  state.rng = r.rng;
  return r.value;
}

function randInt(state: WorldState, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pushLog(state: WorldState, e: RawEvent): void {
  state.log.push(e);
  if (state.log.length > MAX_RAW_EVENTS + 20) {
    // Garde les 200 derniers + compteur (ecart spec documente).
    const drop = state.log.length - MAX_RAW_EVENTS;
    state.log.splice(0, drop);
    const first = state.log[0];
    if (first && first.type !== "overflow") {
      state.log.unshift({ tick: state.tick, type: "overflow", actors: [], place: "village", data: { dropped: drop } });
    }
  }
}

function buildingById(state: WorldState, id: string): Building | undefined {
  return state.buildings.find((b) => b.id === id);
}

/** Assez proche d'un batiment pour y dormir, manger ou travailler (case voisine incluse). */
function isAt(c: Character, b: Building): boolean {
  return Math.abs(c.pos.c - b.c) <= 1 && Math.abs(c.pos.r - b.r) <= 1;
}

function lieuOf(b: Building | undefined): string {
  if (!b) return "village";
  if (b.type === "house") return "house";
  return b.type;
}

function hasTrait(c: Character, t: string): boolean {
  return c.traits.includes(t);
}

function hourOf(tick: number): number {
  return Math.floor(tick / 2);
}

function isNight(tick: number): boolean {
  const h = hourOf(tick);
  return h < 6 || h >= 22;
}

function chebyshev(a: { c: number; r: number }, b: { c: number; r: number }): number {
  return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
}

function findRelation(state: WorldState, a: string, b: string) {
  return state.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

// --- Assignation de taches ---

function goto(state: WorldState, c: Character, dest: Building, after: string): void {
  if (isAt(c, dest)) {
    if (after === "mingle") {
      c.state = "idle";
      c.task = "mingle";
      c.timer = 8;
    } else {
      c.task = after;
      c.state = "idle";
      c.timer = 0;
    }
    return;
  }
  c.state = "walk";
  c.task = `goto:${dest.c}:${dest.r}:${after}`;
  c.timer = 24;
}

function startSleep(state: WorldState, c: Character): void {
  const home = buildingById(state, c.homeId) ?? buildingById(state, "hall");
  if (home && !isAt(c, home)) {
    goto(state, c, home, "sleep");
    return;
  }
  c.state = "sleep";
  c.task = "sleep";
  c.timer = 14 + randInt(state, 0, 4);
  pushLog(state, { tick: state.tick, type: "sleep", actors: [c.name], place: lieuOf(home), data: {} });
}

function startEat(state: WorldState, c: Character): void {
  const hall = buildingById(state, "hall") ?? buildingById(state, c.homeId);
  if (hall && chebyshev(c.pos, hall) > 3) {
    goto(state, c, hall, "eat");
    return;
  }
  c.state = "eat";
  c.task = "eat";
  c.timer = 2;
}

function startWork(state: WorldState, c: Character, siteBias: number): void {
  // Disette : les ventres d'abord. Si les reserves sont basses, aux champs.
  let targetId = c.workId;
  if (state.resources.food < 40) {
    const field = state.buildings.find((b) => b.type === "field");
    if (field && rand(state) < 0.8) targetId = field.id;
  } else if (c.kind === "extra" && rand(state) < siteBias) {
    // Les figurants vont au chantier ~60% du temps (spec 5.4).
    const site = state.buildings.find((b) => b.type === "site");
    if (site && site.progress < 100) targetId = site.id;
  }
  const dest = buildingById(state, targetId) ?? buildingById(state, "hall");
  if (!dest) return;
  if (!isAt(c, dest)) {
    goto(state, c, dest, `work:${dest.id}`);
    return;
  }
  c.state = "work";
  c.task = `work:${dest.id}`;
  c.timer = 6 + randInt(state, 0, 4);
  pushLog(state, { tick: state.tick, type: "work_start", actors: [c.name], place: lieuOf(dest), data: { at: dest.id, role: c.role } });
}

function needsCare(c: Character): boolean {
  return c.needs.food < 35 || c.needs.energy < 30;
}

/** Compteur de debug (tests) : discussions demarrees, journalisees ou non. */
export const talkStats = { started: 0, figureFigure: 0 };

function startTalk(state: WorldState, a: Character, b: Character, place: string): void {
  // Jamais de discussion pour un personnage affame ou epuise : il doit manger/dormir.
  if (needsCare(a) || needsCare(b)) return;
  talkStats.started++;
  if (a.kind === "figure" && b.kind === "figure") talkStats.figureFigure++;
  a.state = "talk";
  a.task = `talk:${b.id}`;
  a.timer = 4;
  b.state = "talk";
  b.task = `talk:${a.id}`;
  b.timer = 4;
  const rel = findRelation(state, a.id, b.id);
  const drift = randInt(state, 1, 3) * (rel && rel.type === "rival" ? -1 : 1);
  if (rel && rel.type !== "neutral") rel.value = clamp(rel.value + drift, -100, 100);
  a.needs.social = clamp(a.needs.social + 18, 0, 100);
  b.needs.social = clamp(b.needs.social + 18, 0, 100);
  if (a.kind === "figure" && b.kind === "figure") {
    pushLog(state, { tick: state.tick, type: "talk", actors: [a.name, b.name], place, data: { rel: rel?.type ?? "neutral" } });
  }
}

function tryMeetings(state: WorldState): void {
  // Rencontres spontanees + rendez-vous force (fenetre 12h-20h, ticks 24..40).
  // Les marcheurs peuvent s'arreter pour discuter : c'est en chemin qu'on se rencontre.
  const forcedWindow = state.tick >= 24 && state.tick <= 40;
  // Candidats a la discussion : au repos ou en pause sociale (mingle), jamais en marche
  // (un marcheur intercepte n'arrive jamais au chantier), ni au travail/repas/sommeil.
  // Les minglers attendent au marche : ce sont eux qui se rencontrent.
  const cands = state.characters.filter(
    (c) =>
      c.state !== "sleep" &&
      c.state !== "talk" &&
      c.task !== "sleep" &&
      c.task !== "eat" &&
      !(c.task ?? "").startsWith("work:") &&
      !(c.task ?? "").startsWith("talk:") &&
      !(c.task ?? "").startsWith("goto:"),
  );
  // NB : pas de `return` ici (simple sortie de boucle) : les rituels ci-dessous
  // (dejeuner, veillee, filets) doivent tourner meme si un bavardage spontane
  // vient de demarrer, sinon une causette de figurants annule le dejeuner des figures.
  let talked = false;
  for (const c of cands) {
    if (talked) break;
    if (needsCare(c)) continue;
    const threshold = hasTrait(c, "bavard") ? 65 : 55;
    const nearMarket =
      chebyshev(c.pos, { c: 10, r: 7 }) <= 4 ? 25 : 0;
    if (c.needs.social >= threshold + (forcedWindow ? nearMarket : 0) && !forcedWindow) continue;
    if (forcedWindow && c.needs.social >= 90) continue;
    // Discussions spontanees strictement entre semblables : les figures entre figures
    // (la chronique ne parle que d'elles), les figurants entre eux. Un bavardage mixte
    // non journalise ferait juste rater l'assemblee aux figures sans rien raconter.
    const near = (o: Character): boolean =>
      o.id !== c.id && o.kind === c.kind && !needsCare(o) && chebyshev(o.pos, c.pos) <= 2;
    const partner = cands.find((o) => near(o));
    if (partner) {
      const b = buildingById(state, c.workId);
      startTalk(state, c, partner, lieuOf(b));
      talked = true; // une conversation spontanee par tick suffit
    }
  }
  if (state.tick === 25) {
    // Le dejeuner : a 13h, les figures gagnent la halle pour manger ensemble.
    // C'est le rituel qui garantit des rencontres : colocalisation + attarde post-repas.
    // Meme les affamees viennent : le dejeuner EST leur repas. Seules les epuisees
    // (energie < 15, risque de malaise) vont dormir, et on ne reveille ni ne coupe personne.
    const hall = buildingById(state, "hall");
    if (hall) {
      for (const f of state.characters.filter((c) => c.kind === "figure")) {
        if (f.state === "sleep" || f.state === "talk" || f.task === "sleep" || f.task === "eat") continue;
        if (f.needs.energy < 15) continue;
        if (f.needs.food > 62) continue;
        const after = (f.task ?? "").startsWith("goto:") ? (f.task as string).split(":").slice(3).join(":") : null;
        if (after === "sleep" || after === "eat") continue;
        goto(state, f, hall, "eat");
      }
    }
  }
  if (state.tick === 33) {
    // Filet de securite : si aucune conversation de figures n'a eu lieu aujourd'hui,
    // apparie directement les deux figures valides les plus proches (l'assemblee du marche).
    if (!state.log.some((e) => e.type === "talk")) {
      const figs = state.characters.filter(
        (c) => c.kind === "figure" && c.state !== "sleep" && c.state !== "talk" && !needsCare(c) && c.task !== "sleep" && c.task !== "eat",
      );
      let best: [Character, Character] | null = null;
      let bestD = 7;
      for (let i = 0; i < figs.length; i++) {
        for (let j = i + 1; j < figs.length; j++) {
          const a = figs[i] as Character;
          const b = figs[j] as Character;
          const d = chebyshev(a.pos, b.pos);
          if (d < bestD) {
            bestD = d;
            best = [a, b];
          }
        }
      }
      if (best) startTalk(state, best[0], best[1], "market");
    }
  }
  if (state.tick === 41) {
    // La veillee : a 20h30, les figures gagnent la halle pour la soiree.
    // Les affamees y dinent (puis s'attardent), les autres veillent. Meme logique que le dejeuner.
    const hall = buildingById(state, "hall");
    if (hall && !state.log.some((e) => e.type === "talk")) {
      for (const f of state.characters.filter((c) => c.kind === "figure")) {
        if (f.state === "sleep" || f.state === "talk" || f.task === "sleep" || f.task === "eat") continue;
        if (f.needs.energy < 15) continue;
        const after = (f.task ?? "").startsWith("goto:") ? (f.task as string).split(":").slice(3).join(":") : null;
        if (after === "sleep" || after === "eat") continue;
        goto(state, f, hall, f.needs.food < 45 ? "eat" : "mingle");
      }
    }
  }
  if (state.tick === 45) {
    // Dernier filet : s'il n'y a toujours pas de conversation de figures aujourd'hui,
    // on apparie les deux figures valides les plus proches. A 22h30, la veillee les a
    // rassemblees a la halle : elles sont forcément presque voisines.
    if (!state.log.some((e) => e.type === "talk")) {
      const figs = state.characters.filter(
        (c) => c.kind === "figure" && c.state !== "sleep" && c.state !== "talk" && !needsCare(c) && c.task !== "sleep" && c.task !== "eat",
      );
      let best: [Character, Character] | null = null;
      let bestD = 13;
      for (let i = 0; i < figs.length; i++) {
        for (let j = i + 1; j < figs.length; j++) {
          const a = figs[i] as Character;
          const b = figs[j] as Character;
          const d = chebyshev(a.pos, b.pos);
          if (d < bestD) {
            bestD = d;
            best = [a, b];
          }
        }
      }
      if (best) startTalk(state, best[0], best[1], "hall");
    }
  }
}

function finishTask(state: WorldState, c: Character): void {
  const task = c.task ?? "";
  if (task === "eat") {
    if (state.resources.food >= 2) {
      state.resources.food = clamp(state.resources.food - 2, 0, 100);
      c.needs.food = clamp(c.needs.food + 45, 0, 100);
      pushLog(state, { tick: state.tick, type: "meal", actors: [c.name], place: "hall", data: {} });
    } else {
      c.needs.food = clamp(c.needs.food + 5, 0, 100);
      pushLog(state, { tick: state.tick, type: "hunger", actors: [c.name], place: "hall", data: {} });
    }
    // Apres le repas, on s'attarde : c'est la que naissent les conversations.
    if (rand(state) < 0.6) {
      c.state = "idle";
      c.task = "mingle";
      c.timer = 5;
      return;
    }
  } else if (task === "sleep") {
    pushLog(state, { tick: state.tick, type: "wake", actors: [c.name], place: "house", data: {} });
  } else if (task.startsWith("work:")) {
    const at = task.slice(5);
    pushLog(state, { tick: state.tick, type: "work_end", actors: [c.name], place: lieuOf(buildingById(state, at)), data: { at } });
  } else if (task === "mingle") {
    c.needs.social = clamp(c.needs.social + 6, 0, 100);
  }
  c.state = "idle";
  c.task = null;
  c.timer = 0;
}

function continueTask(state: WorldState, c: Character): void {
  const task = c.task ?? "";
  if (task.startsWith("goto:")) {
    const parts = task.split(":");
    const tc = Number(parts[1]);
    const tr = Number(parts[2]);
    const after = parts.slice(3).join(":");
    const step = nextStep(state, c.pos.c, c.pos.r, tc, tr);
    if (!step) {
      if (after === "mingle") {
        c.task = "mingle";
        c.state = "idle";
        c.timer = 8;
      } else {
        c.task = after || null;
        c.state = "idle";
        c.timer = 0;
      }
      return;
    }
    c.pos = { c: step.c, r: step.r };
    c.timer -= 1;
    // Arrive si sur la cible ou a une case (les batiments sont occupes, on s'arrete a cote).
    const arrived = (c.pos.c === tc && c.pos.r === tr) || Math.abs(c.pos.c - tc) <= 1 && Math.abs(c.pos.r - tr) <= 1;
    if (arrived) {
      if (after === "mingle") {
        c.task = "mingle";
        c.state = "idle";
        c.timer = 8;
      } else {
        c.task = after || null;
        c.state = "idle";
        c.timer = 0;
      }
    } else if (c.timer <= 0) {
      // Abandonne la marche, agira sur place (evite les blocages).
      if (after === "mingle") {
        c.task = "mingle";
        c.state = "idle";
        c.timer = 6;
      } else {
        c.task = after || null;
        c.state = "idle";
        c.timer = 0;
      }
    }
    return;
  }
  if (task === "sleep") {
    const gain = hasTrait(c, "anxieux") ? 3.5 : 5;
    c.needs.energy = clamp(c.needs.energy + gain, 0, 100);
    c.needs.social = clamp(c.needs.social - 0.4, 0, 100);
    c.timer -= 1;
    if (c.timer <= 0 || c.needs.energy >= 99) finishTask(state, c);
    return;
  }
  if (task === "eat") {
    c.timer -= 1;
    if (c.timer <= 0) finishTask(state, c);
    return;
  }
  if (task.startsWith("work:")) {
    const at = task.slice(5);
    const b = buildingById(state, at);
    const mult = hasTrait(c, "tenace") ? 1.25 : 1;
    if (b?.type === "field" || at === "field_1") {
      state.resources.food = clamp(state.resources.food + 0.95 * mult, 0, 100);
    } else if (b?.type === "forest" || at === "forest_1") {
      state.resources.wood = clamp(state.resources.wood + 0.7 * mult, 0, 100);
    } else if (b?.type === "market") {
      state.resources.goods = clamp(state.resources.goods + 0.45 * mult, 0, 100);
    } else if (b?.type === "site") {
      const before = b.progress;
      b.progress = clamp(b.progress + 1.15 * mult, 0, 100);
      state.resources.wood = clamp(state.resources.wood - 0.12, 0, 100);
      const milestone = (m: number): boolean => before < m && b.progress >= m;
      if (milestone(25) || milestone(50) || milestone(75)) {
        pushLog(state, { tick: state.tick, type: "site", actors: [], place: "site", data: { progress: Math.round(b.progress) } });
      }
      if (b.progress >= 100) {
        pushLog(state, { tick: state.tick, type: "site_done", actors: [c.name], place: "site", data: { site: b.id } });
        completeSite(state, b);
      }
    } else if (b?.type === "hall") {
      state.resources.goods = clamp(state.resources.goods + 0.25 * mult, 0, 100);
      c.needs.social = clamp(c.needs.social + 0.8, 0, 100);
    }
    c.needs.energy = clamp(c.needs.energy - 0.35, 0, 100);
    c.timer -= 1;
    if (c.timer <= 0) finishTask(state, c);
    return;
  }
  if (task.startsWith("talk:")) {
    c.timer -= 1;
    if (c.timer <= 0) {
      c.state = "idle";
      c.task = null;
      c.timer = 0;
    }
    return;
  }
  if (task === "mingle") {
    c.needs.social = clamp(c.needs.social + 0.6, 0, 100);
    c.timer -= 1;
    if (c.timer <= 0) {
      c.state = "idle";
      c.task = null;
      c.timer = 0;
    }
    return;
  }
  c.timer -= 1;
  if (c.timer <= 0) finishTask(state, c);
}

function completeSite(state: WorldState, site: Building): void {
  // Le chantier devient une maison, un nouveau chantier apparait ailleurs.
  site.type = "house";
  site.progress = 100;
  const n = state.buildings.filter((b) => b.type === "house").length + 1;
  site.id = `house_${n}`;
  site.capacity = 4;
  const spots: { c: number; r: number }[] = [];
  for (let r = 3; r <= 11; r++) {
    for (let c = 4; c <= 16; c++) {
      if (state.map.tiles[r * state.map.cols + c] !== ".") continue;
      if (state.buildings.some((b) => Math.abs(b.c - c) + Math.abs(b.r - r) < 2)) continue;
      spots.push({ c, r });
    }
  }
  if (spots.length > 0) {
    const s = spots[Math.floor(rand(state) * spots.length)] as { c: number; r: number };
    state.buildings.push({ id: `site_${state.day}`, type: "site", c: s.c, r: s.r, progress: 0, capacity: 6 });
  }
}

function chooseTask(state: WorldState, c: Character): void {
  const socialGate = hasTrait(c, "bavard") ? 45 : 35;
  // Rythme circadien : la nuit, on dort (sauf les rares pleines d'energie).
  // Sans ca, le village veille jusqu'a 6h puis s'effondre a midi pile quand il faut parler.
  if (isNight(state.tick) && c.needs.energy < 72 && rand(state) < 0.85) {
    startSleep(state, c);
    return;
  }
  if (c.needs.energy < 25) {
    startSleep(state, c);
    return;
  }
  // La nuit, les figures fatiguees dorment meme au-dessus du seuil.
  if (isNight(state.tick) && c.needs.energy < 45 && rand(state) < 0.5) {
    startSleep(state, c);
    return;
  }
  if (c.needs.food < 30) {
    startEat(state, c);
    return;
  }
  if (c.needs.social < socialGate) {
    const market = buildingById(state, "market");
    if (market && chebyshev(c.pos, market) > 2) {
      goto(state, c, market, "mingle");
      return;
    }
    c.state = "idle";
    c.task = "mingle";
    c.timer = 8;
    return;
  }
  startWork(state, c, 0.6);
}

/** Un tick = 30 minutes simulees. */
export function tick(state: WorldState): void {
  // Decroissance des besoins
  for (const c of state.characters) {
    const night = isNight(state.tick);
    c.needs.food = clamp(c.needs.food - 1.5, 0, 100);
    c.needs.social = clamp(c.needs.social - (hasTrait(c, "bavard") ? 0.75 : 0.55), 0, 100);
    if (c.state !== "sleep") {
      c.needs.energy = clamp(c.needs.energy - (night ? 1.45 : 1.05) - (hasTrait(c, "anxieux") ? 0.15 : 0), 0, 100);
    }
  }
  // Penurie : nourriture basse 12 ticks d'affilee
  const t = state as WorldState & { _short?: number };
  if (state.resources.food < 30) {
    t._short = (t._short ?? 0) + 1;
    if (t._short === 12) {
      pushLog(state, { tick: state.tick, type: "shortage", actors: [], place: "village", data: { food: Math.round(state.resources.food) } });
    }
  } else {
    t._short = 0;
  }
  // Avance les taches
  for (const c of state.characters) {
    if (c.timer > 0 || (c.task !== null && c.state !== "idle")) {
      continueTask(state, c);
    } else {
      chooseTask(state, c);
    }
  }
  tryMeetings(state);
  state.tick += 1;
}

/** Une journee entiere : effets en attente, 48 ticks, compteurs. */
export function runDay(state: WorldState): void {
  applyPendingEffects(state, (e) => pushLog(state, e));
  if (state.playerAdds.length > 0) {
    for (const a of state.playerAdds) {
      pushLog(state, { tick: state.tick, type: "player_add", actors: [], place: "village", data: { text: a } });
    }
    state.playerAdds = [];
  }
  state.log = [];
  state.tick = 0;
  for (let i = 0; i < DAY_TICKS; i++) {
    state.tick = i;
    tick(state);
  }
  state.tick = 0;
  state.day += 1;
}
