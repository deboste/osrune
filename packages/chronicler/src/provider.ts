// Fournisseur du chroniqueur : OpenRouter (defaut, spec 3.2) ou OpenCode Zen.
// Chaque slot (primaire, fallback) a SON fournisseur et SON modele : on peut donc
// chainer Zen puis OpenRouter (deux quotas gratuits independants).
// Variables : CHRONICLER_PROVIDER / CHRONICLER_FALLBACK_PROVIDER (openrouter|zen),
// CHRONICLER_MODEL / CHRONICLER_MODEL_FALLBACK, CHRONICLER_BASE_URL,
// OPENROUTER_API_KEY, ZEN_API_KEY (ou OPENCODE_ZEN_API_KEY), CHRONICLER_API (chat|responses).

export interface ProviderConfig {
  name: "openrouter" | "zen";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function providerConfig(which: "primary" | "fallback" = "primary"): ProviderConfig {
  const providerEnv = which === "fallback" ? process.env["CHRONICLER_FALLBACK_PROVIDER"] : undefined;
  const name = (providerEnv ?? process.env["CHRONICLER_PROVIDER"] ?? "openrouter") === "zen" ? "zen" : "openrouter";
  const modelEnv = which === "fallback" ? "CHRONICLER_MODEL_FALLBACK" : "CHRONICLER_MODEL";
  if (name === "zen") {
    return {
      name,
      baseUrl: process.env["CHRONICLER_BASE_URL"] ?? "https://opencode.ai/zen/v1",
      apiKey: process.env["ZEN_API_KEY"] ?? process.env["OPENCODE_ZEN_API_KEY"] ?? "",
      // Gratuits : Muse Spark passe par /responses (transport devine par prefixe).
      model:
        process.env[modelEnv] ?? (which === "fallback" ? "big-pickle" : "muse-spark-1.3-contributor-free"),
    };
  }
  return {
    name,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
    model: process.env[modelEnv] ?? (which === "fallback" ? "z-ai/glm-5.2:free" : "minimax/minimax-m3:free"),
  };
}

export function chatUrl(cfg: ProviderConfig): string {
  return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export function chatHeaders(cfg: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  if (cfg.name === "openrouter") {
    h["HTTP-Referer"] = "https://osrune.game";
    h["X-Title"] = "OSRune chronicler";
  }
  return h;
}
