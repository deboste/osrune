// Resume de periode : un seul appel pour les jours anciens (spec 6.3, 7.4).

import { providerConfig, chatHeaders, chatUrl } from "./provider.js";
import { PeriodSummarySchema, extractJson, type PeriodSummary } from "./schema.js";
import { costCents, envPricing, estimateTokens } from "./tokens.js";
import { templatePeriod } from "./template.js";

export interface WritePeriodInput {
  from: number;
  to: number;
  /** Journaux condenses tronques (10 lignes max par jour recommande). */
  dayLines: { day: number; lines: string[] }[];
  offline?: boolean;
}

export interface WritePeriodResult {
  output: PeriodSummary;
  source: "model" | "template";
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  latencyMs: number;
}

function buildPeriodPrompt(i: WritePeriodInput): string {
  const body = i.dayLines
    .map((d) => `Jour ${d.day} :\n${d.lines.slice(0, 10).map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  return [
    "Tu es le chroniqueur d'un village simule. Tu ecris dans un style de conte, concret, en phrases courtes.",
    "Tu ne contredis jamais le journal. Tu n'utilises pas de tiret cadratin.",
    `Resume les jours ${i.from} a ${i.to} en 3 a 5 phrases, a partir des journaux ci-dessous.`,
    "Reponds uniquement avec un objet JSON valide, sans texte autour :",
    `{"resume": "3 a 5 phrases", "memoires": {"Nom": "une phrase de 12 mots maximum"}}`,
    "",
    body,
  ].join("\n");
}

export async function writePeriod(i: WritePeriodInput): Promise<WritePeriodResult> {
  const enabled = (process.env["CHRONICLER_ENABLED"] ?? "true") !== "false";
  const cfg = providerConfig();
  const { priceInPerM, priceOutPerM } = envPricing();
  const prompt = buildPeriodPrompt(i);
  const tokensInEst = estimateTokens(prompt);
  const allLines = i.dayLines.flatMap((d) => d.lines);

  if (i.offline || !enabled) {
    return {
      output: templatePeriod(i.from, i.to, allLines),
      source: "template",
      modelId: "template",
      tokensIn: tokensInEst,
      tokensOut: 120,
      costCents: 0,
      latencyMs: 0,
    };
  }
  try {
    if (!cfg.apiKey) throw new Error(`missing api key (${cfg.name})`);
    const t0 = Date.now();
    const res = await fetch(chatUrl(cfg), {
      method: "POST",
      headers: chatHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 400,
        temperature: 0.5,
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
    const inT = json.usage?.prompt_tokens ?? tokensInEst;
    const outT = json.usage?.completion_tokens ?? estimateTokens(text);
    const parsed = PeriodSummarySchema.parse(extractJson(text));
    return {
      output: parsed,
      source: "model",
      modelId: cfg.model,
      tokensIn: inT,
      tokensOut: outT,
      costCents: costCents({ tokensIn: inT, tokensOut: outT, priceInPerM, priceOutPerM }),
      latencyMs: ms,
    };
  } catch {
    return {
      output: templatePeriod(i.from, i.to, allLines),
      source: "template",
      modelId: "template",
      tokensIn: tokensInEst,
      tokensOut: 120,
      costCents: 0,
      latencyMs: 0,
    };
  }
}
