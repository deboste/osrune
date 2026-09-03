// Client modele du chroniqueur : 1 appel/jour, retry unique avec erreur Zod, gabarit sinon.
// Spec 7.3. Fournisseur configurable (OpenRouter par defaut, OpenCode Zen via env).
// response_format json_object impose pour viser >=95% de JSON valide au 1er essai.

import { providerConfig } from "./provider.js";
import { requestText } from "./transport.js";
import { ChronicleOutputSchema, extractJson, type ChronicleOutput } from "./schema.js";
import { costCents, envPricing, estimateTokens } from "./tokens.js";
import { templateChronicle } from "./template.js";

export interface WriteDayInput {
  prompt: string;
  day: number;
  condensed: string[];
  figureNames: string[];
  offline?: boolean;
}

export interface WriteDayResult {
  output: ChronicleOutput;
  source: "model" | "template";
  /** true si le second appel de correction a ete necessaire (mesure du critere 95 %). */
  retried: boolean;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  latencyMs: number;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function validateNames(o: ChronicleOutput, figureNames: string[]): string | null {
  const known = new Set(figureNames);
  for (const e of o.chronique) {
    for (const a of e.acteurs) {
      if (a && !known.has(a)) return `acteur inconnu: ${a}`;
    }
  }
  for (const k of Object.keys(o.repliques)) {
    if (!known.has(k)) return `replique inconnue: ${k}`;
  }
  return null;
}

export async function writeDay(i: WriteDayInput): Promise<WriteDayResult> {
  const enabled = env("CHRONICLER_ENABLED", "true") !== "false";
  const primary = providerConfig("primary");
  const fallbackCfg = providerConfig("fallback");
  const { priceInPerM, priceOutPerM } = envPricing();
  const tokensInEst = estimateTokens(i.prompt);

  if (i.offline || !enabled) {
    return {
      output: templateChronicle(i.day, i.condensed, "fire", i.figureNames),
      source: "template",
      retried: false,
      modelId: "template",
      tokensIn: tokensInEst,
      tokensOut: 180,
      costCents: 0,
      latencyMs: 0,
    };
  }

  const slots = [
    { cfg: primary, model: primary.model },
    { cfg: fallbackCfg, model: fallbackCfg.model },
  ];
  let lastErr = "";
  for (const { cfg, model: m } of slots) {
    try {
      const r1 = await requestText(cfg, m, { prompt: i.prompt, maxTokens: 600, temperature: 0.7 });
      try {
        const parsed = ChronicleOutputSchema.parse(extractJson(r1.text));
        const nameErr = validateNames(parsed, i.figureNames);
        if (nameErr) throw new Error(nameErr);
        return {
          output: parsed,
          source: "model",
          retried: false,
          modelId: m,
          tokensIn: r1.inT,
          tokensOut: r1.outT,
          costCents: costCents({ tokensIn: r1.inT, tokensOut: r1.outT, priceInPerM, priceOutPerM }),
          latencyMs: r1.ms,
        };
      } catch (zErr) {
        lastErr = String(zErr);
        // Second appel : corrige uniquement le JSON (spec 7.3)
        const fix = await requestText(cfg, m, {
          prompt: `${i.prompt}\n\nTon JSON precedent etait invalide : ${lastErr.slice(0, 400)}. Corrige uniquement le JSON.`,
          maxTokens: 600,
          temperature: 0.7,
        });
        const parsed = ChronicleOutputSchema.parse(extractJson(fix.text));
        const nameErr = validateNames(parsed, i.figureNames);
        if (nameErr) throw new Error(nameErr);
        return {
          output: parsed,
          source: "model",
          retried: true,
          modelId: m,
          tokensIn: fix.inT,
          tokensOut: fix.outT,
          costCents: costCents({ tokensIn: fix.inT, tokensOut: fix.outT, priceInPerM, priceOutPerM }),
          latencyMs: r1.ms + fix.ms,
        };
      }
    } catch (e) {
      lastErr = String(e);
      continue; // modele suivant (fallback), puis gabarit
    }
  }
  void lastErr;
  return {
    output: templateChronicle(i.day, i.condensed, "fire", i.figureNames),
    source: "template",
    retried: false,
    modelId: "template",
    tokensIn: tokensInEst,
    tokensOut: 180,
    costCents: 0,
    latencyMs: 0,
  };
}
