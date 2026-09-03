// Creation des figures a la creation du monde (spec 9.1) : un appel modele,
// gabarit deterministe en secours. Compte dans le budget du monde.

import { z } from "zod";
import { content } from "@osrune/content";
import { extractJson } from "./schema.js";
import { estimateTokens } from "./tokens.js";

export const FigureDraftSchema = z.object({
  name: z.string().min(2).max(24),
  gender: z.enum(["f", "m"]),
  ageYears: z.number().int().min(16).max(70),
  role: z.string().min(2).max(30),
  traits: z.tuple([z.string().min(2).max(24), z.string().min(2).max(24), z.string().min(2).max(24)]),
  goal: z.string().min(5).max(80),
});

export const CreateFiguresSchema = z.object({
  figures: z.tuple([
    FigureDraftSchema,
    FigureDraftSchema,
    FigureDraftSchema,
    FigureDraftSchema,
    FigureDraftSchema,
  ]),
});

export type FigureDraft = z.infer<typeof FigureDraftSchema>;

export interface CreateFiguresInput {
  worldName: string;
  userPrompt?: string;
  seed: number;
  offline?: boolean;
}

function mulberry(seed: number): () => number {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function templateFigures(seed: number): FigureDraft[] {
  const rnd = mulberry(seed ^ 0x5eed);
  const fire = content.fire;
  const names = [...fire.figureNames].sort(() => rnd() - 0.5).slice(0, 5);
  const roles = [...fire.roles].sort(() => rnd() - 0.5);
  const goals = [...fire.goals].sort(() => rnd() - 0.5);
  return names.map((n, i) => {
    const traits = [...fire.traits].sort(() => rnd() - 0.5).slice(0, 3) as [string, string, string];
    return {
      name: n.name,
      gender: n.gender,
      ageYears: 19 + Math.floor(rnd() * 38),
      role: (roles[i] ?? "aide").slice(0, 30),
      traits,
      goal: (goals[i] ?? "Garder le feu.").slice(0, 80),
    };
  });
}

export async function createFigures(i: CreateFiguresInput): Promise<{ figures: FigureDraft[]; source: "model" | "template" }> {
  const enabled = (process.env["CHRONICLER_ENABLED"] ?? "true") !== "false";
  const model = process.env["CHRONICLER_MODEL"] ?? "deepseek/deepseek-chat-v3-0324";
  if (i.offline || !enabled || !process.env["OPENROUTER_API_KEY"]) {
    return { figures: templateFigures(i.seed), source: "template" };
  }
  try {
    const prompt = [
      `Pour le jeu de village "${i.worldName}" (Age du Feu), invente 5 villageois memorables.`,
      i.userPrompt ? `Inspiration du joueur : ${i.userPrompt.slice(0, 200)}` : "Aucune inspiration.",
      "Metiers possibles : tisserande, forgeron, meuniere, bucheron, potier, berger.",
      "Reponds uniquement avec un objet JSON valide :",
      `{"figures": [{"name": "prenom", "gender": "f|m", "ageYears": 30, "role": "metier", "traits": ["a", "b", "c"], "goal": "objectif en une phrase"} x 5]}`,
    ].join("\n");
    void estimateTokens;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["OPENROUTER_API_KEY"] as string}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://osrune.game",
        "X-Title": "OSRune chronicler",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = CreateFiguresSchema.parse(extractJson(json.choices?.[0]?.message?.content ?? ""));
    return { figures: [...parsed.figures], source: "model" };
  } catch {
    return { figures: templateFigures(i.seed), source: "template" };
  }
}
