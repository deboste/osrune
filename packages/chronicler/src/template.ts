// Gabarit hors ligne : fonction pure, toujours testee (spec 7.5).
// Utilise en --offline, double echec modele, depassement budget.

import { content, type AgeId } from "@osrune/content";
import type { ChronicleOutput } from "./schema.js";

export function templateChronicle(day: number, condensed: string[], ageId: AgeId = "fire", figureNames: string[] = []): ChronicleOutput {
  const talks = condensed.filter((l) => l.includes("discutent"));
  const site = condensed.filter((l) => l.toLowerCase().includes("chantier"));
  const shortage = condensed.filter((l) => l.toLowerCase().includes("reserve") || l.toLowerCase().includes("faim"));
  const adds = condensed.filter((l) => l.startsWith("Le joueur ajoute"));
  const entries: ChronicleOutput["chronique"] = [];

  if (talks[0]) {
    entries.push({ texte: `${talks[0]} Les voix portent jusqu'au soir.`, alerte: false, lieu: "market", acteurs: [] });
  }
  if (site[0]) {
    entries.push({ texte: `${site[0]} Les bras ne manquent pas et le bois sent bon.`, alerte: false, lieu: "site", acteurs: [] });
  }
  if (shortage[0]) {
    entries.push({ texte: `${shortage[0]} On serre les dents et on partage.`, alerte: true, lieu: "hall", acteurs: [] });
  }
  if (adds[0]) {
    entries.push({ texte: `${adds[0]} Le village en parle autour du feu.`, alerte: false, lieu: "hall", acteurs: [] });
  }
  while (entries.length < 2) {
    entries.push({ texte: `Le jour ${day} passe au village. Le feu veille et chacun fait sa part.`, alerte: false, lieu: "hall", acteurs: [] });
  }
  const picked = entries.slice(0, 2);

  const age = content[ageId];
  const fb = age.fallbackDecisions[(day - 1) % age.fallbackDecisions.length] as (typeof age.fallbackDecisions)[number];
  const repliques: Record<string, string> = {};
  for (const n of figureNames.slice(0, 5)) {
    repliques[n] = age.fallbackQuotes[(day + n.length) % age.fallbackQuotes.length] as string;
  }
  const opts = fb.options.map((o) => ({
    label: o.label,
    effets: o.effects.map((e) => ({ target: e.target, id: e.id, delta: e.delta })),
  }));
  if (opts.length !== 3) throw new Error("fallback decision must have 3 options");
  const options = opts as [typeof opts[number], typeof opts[number], typeof opts[number]];
  return {
    chronique: picked,
    decision: { titre: fb.titre, texte: fb.texte, options },
    repliques,
    memoires: {},
  };
}

export function templatePeriod(from: number, to: number, lines: string[]): { resume: string; memoires: Record<string, string> } {
  const kept = lines.slice(0, 12).join(" ");
  return {
    resume: `Les jours ${from} a ${to} en bref. ${kept.slice(0, 500)}`.slice(0, 900),
    memoires: {},
  };
}
