// Client modele du chroniqueur : 1 appel/jour, retry unique avec erreur Zod, gabarit sinon.
// Spec 7.3. Fournisseur configurable (OpenRouter par defaut, OpenCode Zen via env).
// response_format json_object impose pour viser >=95% de JSON valide au 1er essai.

import { providerConfig, chatHeaders, chatUrl, type ProviderConfig } from "./provider.js";
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

async function callModel(
  cfg: ProviderConfig,
  prompt: string,
  model: string,
  maxTokens: number,
): Promise<{ text: string; inT: number; outT: number; ms: number }> {
  if (!cfg.apiKey) throw new Error(`missing api key (${cfg.name})`);
  const t0 = Date.now();
  const res = await fetch(chatUrl(cfg), {
    method: "POST",
    headers: chatHeaders(cfg),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`${cfg.name} ${res.status}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const inT = json.usage?.prompt_tokens ?? estimateTokens(prompt);
  const outT = json.usage?.completion_tokens ?? estimateTokens(text);
  return { text, inT, outT, ms };
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
  const cfg = providerConfig();
  const { model, fallback } = cfg;
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

  const models = [model, fallback];
  let lastErr = "";
  for (const m of models) {
    try {
      const r1 = await callModel(cfg, i.prompt, m, 600);
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
        const fix = await callModel(cfg, `${i.prompt}\n\nTon JSON precedent etait invalide : ${lastErr.slice(0, 400)}. Corrige uniquement le JSON.`, m, 600);
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
