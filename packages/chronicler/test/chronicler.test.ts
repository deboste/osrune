import { describe, expect, it } from "vitest";
import { ChronicleOutputSchema, extractJson } from "../src/schema.js";
import { apiFor, extractResponsesText } from "../src/transport.js";
import { templateChronicle } from "../src/template.js";
import { buildPrompt } from "../src/prompt.js";
import { estimateTokens, costCents } from "../src/tokens.js";

describe("chroniqueur", () => {
  it("gabarit produit un JSON valide au schema", () => {
    const condensed = [
      "Mira tisse au marche (8 h a 12 h).",
      "Corin et Aldric discutent au marche (14 h).",
      "Le chantier atteint 50 %.",
      "Reserves : nourriture 60, bois 50, biens 30.",
    ];
    const o = templateChronicle(3, condensed, "fire", ["Mira", "Corin", "Aldric", "Sella", "Borin"]);
    expect(() => ChronicleOutputSchema.parse(o)).not.toThrow();
    expect(o.decision.options).toHaveLength(3);
  });
  it("extractJson tolere les balises code", () => {
    const raw = 'voici ```json\n{"chronique": [{"texte": "Le feu veille sur le village et chacun fait sa part.", "alerte": false, "lieu": "hall", "acteurs": []}, {"texte": "Au marche on discute des reserves du grenier commun.", "alerte": false, "lieu": "market", "acteurs": []}], "decision": {"titre": "Partager ?", "texte": "Les greniers baissent et il faut choisir vite.", "options": [{"label": "Rationner", "effets": [{"target": "resources", "id": "food", "delta": 5}]}, {"label": "Partager", "effets": [{"target": "resources", "id": "food", "delta": -5}]}, {"label": "Troquer", "effets": [{"target": "resources", "id": "goods", "delta": 5}]}]}, "repliques": {}, "memoires": {}}``` fin';
    const parsed = ChronicleOutputSchema.parse(extractJson(raw));
    expect(parsed.chronique).toHaveLength(2);
  });
  it("prompt < 2500 tokens estimes, sortie cible < 500", () => {
    const p = buildPrompt({
      worldName: "Village",
      ageLabel: "Age du Feu",
      ageContext: "ctx",
      food: 60,
      wood: 50,
      goods: 30,
      figures: ["Mira", "Corin", "Aldric", "Sella", "Borin"].map((n) => ({
        name: n,
        role: "forgeron",
        ageYears: 30,
        traits: ["brave", "tenace", "doux"],
        goal: "Garder le feu.",
        summary: "memoire courte",
      })),
      relations: [],
      recent: [],
      decisionYesterday: "aucune",
      answerYesterday: "aucune reponse",
      adds: [],
      day: 1,
      condensed: ["ligne 1", "ligne 2"],
    });
    expect(estimateTokens(p)).toBeLessThan(2500);
    expect(costCents({ tokensIn: 2000, tokensOut: 400, priceInPerM: 0.07, priceOutPerM: 0.28 })).toBeLessThan(0.5);
  });
  it("transport : choix d'endpoint par modele + extraction responses", () => {
    expect(apiFor("muse-spark-1.3-contributor-free")).toBe("responses");
    expect(apiFor("gpt-5.4-mini")).toBe("responses");
    expect(apiFor("minimax-m3")).toBe("chat");
    expect(apiFor("mimo-v2.5-free")).toBe("chat");
    expect(apiFor("nimporte-quoi", "responses")).toBe("responses");
    expect(
      extractResponsesText({
        output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true}' }] }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ).toBe('{"ok":true}');
    expect(extractResponsesText({ output_text: '{"ok":2}' })).toBe('{"ok":2}');
    expect(extractResponsesText({})).toBe("");
  });
});
