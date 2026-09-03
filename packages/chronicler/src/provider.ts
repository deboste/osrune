// Fournisseur du chroniqueur : OpenRouter (defaut, spec 3.2) ou OpenCode Zen.
// Meme contrat OpenAI-compatible (/chat/completions), seule la base URL, la cle
// et les ids de modeles changent. Tout se configure par variables d'environnement.

export interface ProviderConfig {
  name: "openrouter" | "zen";
  baseUrl: string;
  apiKey: string;
  model: string;
  fallback: string;
}

export function providerConfig(): ProviderConfig {
  const name = (process.env["CHRONICLER_PROVIDER"] ?? "openrouter") === "zen" ? "zen" : "openrouter";
  if (name === "zen") {
    return {
      name,
      baseUrl: process.env["CHRONICLER_BASE_URL"] ?? "https://opencode.ai/zen/v1",
      apiKey: process.env["ZEN_API_KEY"] ?? process.env["OPENCODE_ZEN_API_KEY"] ?? "",
      // Modeles gratuits, endpoint /chat/completions (pas /responses).
      model: process.env["CHRONICLER_MODEL"] ?? "mimo-v2.5-free",
      fallback: process.env["CHRONICLER_MODEL_FALLBACK"] ?? "big-pickle",
    };
  }
  return {
    name,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
    model: process.env["CHRONICLER_MODEL"] ?? "minimax/minimax-m3:free",
    fallback: process.env["CHRONICLER_MODEL_FALLBACK"] ?? "z-ai/glm-5.2:free",
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
