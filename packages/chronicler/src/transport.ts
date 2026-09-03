// Selection et appel d'endpoint : /chat/completions ou /responses (spec : aucun,
// c'est le client qui s'adapte au modele, pas l'inverse).
// - chat : OpenAI chat completions (OpenRouter, Zen DeepSeek/MiniMax/GLM/Kimi/gratuits chat).
// - responses : OpenAI Responses API (Zen GPT/Grok/Muse Spark).
// Le bon endpoint est devine par prefixe, forcable par CHRONICLER_API, et en cas
// d'erreur 404/400 on essaie l'autre une fois avant d'abandonner le modele.

import { chatHeaders, chatUrl, type ProviderConfig } from "./provider.js";

export type ApiKind = "chat" | "responses";

export function apiFor(model: string, override?: string): ApiKind {
  if (override === "responses" || override === "chat") return override;
  const m = model.toLowerCase();
  if (m.startsWith("gpt-") || m.startsWith("muse-spark-") || m.startsWith("grok-")) return "responses";
  return "chat";
}

export function responsesUrl(cfg: ProviderConfig): string {
  return `${cfg.baseUrl.replace(/\/$/, "")}/responses`;
}

export interface TextResult {
  text: string;
  inT: number;
  outT: number;
  ms: number;
  endpoint: ApiKind;
}

async function callChat(cfg: ProviderConfig, prompt: string, model: string, maxTokens: number, temperature: number): Promise<Omit<TextResult, "endpoint">> {
  const t0 = Date.now();
  const res = await fetch(chatUrl(cfg), {
    method: "POST",
    headers: chatHeaders(cfg),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`${cfg.name}/chat ${res.status} ${(await res.text()).slice(0, 120)}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, inT: json.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4), outT: json.usage?.completion_tokens ?? Math.ceil(text.length / 4), ms };
}

function extractResponsesText(json: unknown): string {
  const root = json as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (typeof root.output_text === "string" && root.output_text.length > 0) return root.output_text;
  for (const item of root.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string" && c.text.length > 0) return c.text;
    }
  }
  return "";
}

async function callResponses(
  cfg: ProviderConfig,
  prompt: string,
  model: string,
  maxTokens: number,
  _temperature: number,
): Promise<Omit<TextResult, "endpoint">> {
  // Modeles a raisonnement (ex. Muse Spark) : le budget de sortie doit couvrir
  // le raisonnement + la reponse, sinon statut "incomplete" et texte vide.
  // Pas de temperature : forcee a 1 cote serveur, certains modeles la refusent.
  const t0 = Date.now();
  const res = await fetch(responsesUrl(cfg), {
    method: "POST",
    headers: chatHeaders(cfg),
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: maxTokens * 3,
      reasoning: { effort: "low" },
      text: { format: { type: "json_object" } },
      store: false,
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`${cfg.name}/responses ${res.status} ${(await res.text()).slice(0, 120)}`);
  const json = (await res.json()) as {
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = extractResponsesText(json);
  return {
    text,
    inT: json.usage?.input_tokens ?? Math.ceil(prompt.length / 4),
    outT: json.usage?.output_tokens ?? Math.ceil(text.length / 4),
    ms,
  };
}

/** Appelle le modele sur le bon endpoint, avec bascule auto sur l'autre en cas de 404/400. */
export async function requestText(
  cfg: ProviderConfig,
  model: string,
  opts: { prompt: string; maxTokens: number; temperature: number },
): Promise<TextResult> {
  const override = process.env["CHRONICLER_API"];
  const first = apiFor(model, override);
  const second: ApiKind = first === "chat" ? "responses" : "chat";
  const run = first === "chat" ? callChat : callResponses;
  try {
    const r = await run(cfg, opts.prompt, model, opts.maxTokens, opts.temperature);
    return { ...r, endpoint: first };
  } catch (e) {
    const msg = String(e);
    if (!/\b(404|400|415|422)\b/.test(msg)) throw e;
    const run2 = second === "chat" ? callChat : callResponses;
    const r = await run2(cfg, opts.prompt, model, opts.maxTokens, opts.temperature);
    return { ...r, endpoint: second };
  }
}

export { extractResponsesText };
