// Journal condense : la seule chose que recoit le chroniqueur (spec 5.5).
// Au plus 40 lignes, factuel, sans style. Francais, phrases courtes.

import type { WorldState } from "./types.js";
import { MAX_CONDENSED_LINES } from "./constants.js";

function hh(tick: number): string {
  return `${Math.min(23, Math.floor(tick / 2))} h`;
}

const ROLE_VERB: Record<string, string> = {
  tisserande: "tisse",
  forgeron: "forge",
  meuniere: "moud le grain",
  bucheron: "coupe du bois",
  potier: "tourne des pots",
  berger: "garde le troupeau",
  aide: "aide au village",
  porteuse: "porte des charges",
  garde: "garde les chemins",
  cueilleur: "cueille des plantes",
};

function verbFor(role: string, place: string): string {
  // Le verbe suit le lieu (on peut etre envoye aux champs en disette), pas le metier.
  if (place === "aux champs") return "recolte";
  if (place === "en foret") return "coupe du bois";
  if (place === "au chantier") return "construit";
  if (place === "au marche") return "troque";
  return ROLE_VERB[role] ?? "travaille";
}

function buildingLabel(state: WorldState, id: string): string {
  const b = state.buildings.find((x) => x.id === id);
  if (!b) return "au village";
  if (b.type === "field") return "aux champs";
  if (b.type === "forest") return "en foret";
  if (b.type === "market") return "au marche";
  if (b.type === "hall") return "a la halle";
  if (b.type === "site") return "au chantier";
  return "a la maison";
}

export function condenseLog(state: WorldState, day: number): string[] {
  const lines: string[] = [];
  const figs = state.characters.filter((c) => c.kind === "figure");
  const figNames = new Set(figs.map((f) => f.name));

  // Travail par figure : agrege work_start/work_end
  const workSpans = new Map<string, { place: string; from: number; to: number; verb: string }>();
  for (const e of state.log) {
    if (e.type === "work_start" && e.actors[0]) {
      const name = e.actors[0];
      if (!figNames.has(name)) continue;
      const at = String(e.data?.["at"] ?? "");
      workSpans.set(name, { place: buildingLabel(state, at), from: e.tick, to: e.tick + 4, verb: "" });
    }
    if (e.type === "work_end" && e.actors[0]) {
      const s = workSpans.get(e.actors[0]);
      if (s) s.to = e.tick;
    }
  }
  for (const f of figs) {
    const s = workSpans.get(f.name);
    if (s) {
      lines.push(`${f.name} ${verbFor(f.role, s.place)} ${s.place} (${hh(s.from)} a ${hh(s.to)}).`);
    }
  }

  // Conversations entre figures
  for (const e of state.log) {
    if (e.type === "talk" && e.actors.length >= 2) {
      const place =
        e.place === "market" ? "au marche" : e.place === "hall" ? "a la halle" : e.place === "field" ? "aux champs" : "au village";
      lines.push(`${e.actors[0]} et ${e.actors[1]} discutent ${place} (${hh(e.tick)}).`);
    }
  }

  // Chantier
  for (const e of state.log) {
    if (e.type === "site") lines.push(`Le chantier atteint ${String(e.data?.["progress"] ?? "?")} %.`);
    if (e.type === "site_done") lines.push(`Le chantier est termine. Une maison neuve se dresse.`);
  }

  // Penuries, faim, effets, ajouts joueur
  for (const e of state.log) {
    if (e.type === "shortage") lines.push(`Les reserves de nourriture sont basses.`);
    if (e.type === "hunger" && e.actors[0]) lines.push(`${e.actors[0]} mange peu. Les reserves sont vides.`);
    if (e.type === "effect") {
      const id = String(e.data?.["id"] ?? "");
      const delta = Number(e.data?.["delta"] ?? 0);
      lines.push(`La decision du joueur porte ses fruits : ${id} ${delta > 0 ? "+" : ""}${delta}.`);
    }
    if (e.type === "player_add") lines.push(`Le joueur ajoute : ${String(e.data?.["text"] ?? "").slice(0, 120)}`);
  }

  // Figurants agreges
  const extraWork = state.log.filter((e) => e.type === "work_start" && e.actors[0]?.startsWith("Figurant")).length;
  const extraSite = state.log.filter(
    (e) => e.type === "work_start" && e.actors[0]?.startsWith("Figurant") && String(e.data?.["at"] ?? "").startsWith("site"),
  ).length;
  if (extraSite > 0) lines.push(extraSite === 1 ? `1 figurant travaille au chantier.` : `${extraSite} figurants travaillent au chantier.`);
  else if (extraWork > 0) lines.push(extraWork === 1 ? `1 figurant travaille au village.` : `${extraWork} figurants travaillent au village.`);

  // Ressources en fin de jour
  lines.push(
    `Reserves : nourriture ${Math.round(state.resources.food)}, bois ${Math.round(state.resources.wood)}, biens ${Math.round(state.resources.goods)}.`,
  );

  void day;
  return lines.slice(0, MAX_CONDENSED_LINES);
}
