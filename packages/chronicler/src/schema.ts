// Schema de sortie du chroniqueur (spec 7.3). Strict, longueurs bornees.

import { z } from "zod";

export const LIEUX = ["hall", "market", "field", "forest", "house", "site"] as const;

export const ChronicleEntrySchema = z.object({
  texte: z.string().min(10).max(280),
  alerte: z.boolean(),
  lieu: z.enum(LIEUX),
  acteurs: z.array(z.string().max(40)).max(4),
});

export const DecisionOptionSchema = z.object({
  label: z.string().min(2).max(30),
  effets: z
    .array(
      z.object({
        target: z.enum(["resources", "relation"]),
        id: z.string().min(1).max(64),
        delta: z.number().int().min(-20).max(20),
      }),
    )
    .min(1)
    .max(3),
});

export const ChronicleOutputSchema = z.object({
  chronique: z.array(ChronicleEntrySchema).min(2).max(3),
  decision: z.object({
    titre: z.string().min(3).max(80),
    texte: z.string().min(10).max(280),
    options: z.tuple([DecisionOptionSchema, DecisionOptionSchema, DecisionOptionSchema]),
  }),
  repliques: z.record(z.string(), z.string().max(160)).default({}),
  memoires: z.record(z.string(), z.string().max(160)).default({}),
});

export type ChronicleOutput = z.infer<typeof ChronicleOutputSchema>;

export const PeriodSummarySchema = z.object({
  resume: z.string().min(20).max(900),
  memoires: z.record(z.string(), z.string().max(160)).default({}),
});

export type PeriodSummary = z.infer<typeof PeriodSummarySchema>;

/** Retire balises code, extrait le premier objet JSON equilibre, parse. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("no json object found");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i] as string;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) as unknown;
      }
    }
  }
  throw new Error("unbalanced json");
}
