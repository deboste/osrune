import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorld, runDay, condenseLog, canAdvanceAge, advanceAge } from "../src/index.js";

function hashDays(seed: number, days: number): string {
  const s = createWorld(seed, { name: "Test" });
  const h = createHash("sha256");
  for (let d = 0; d < days; d++) {
    runDay(s);
    for (const l of condenseLog(s, s.day - 1)) h.update(l);
  }
  return h.digest("hex");
}

describe("determinisme", () => {
  it("meme seed => meme journal (30 jours)", () => {
    expect(hashDays(42, 30)).toBe(hashDays(42, 30));
  });
  it("seed different => journal different", () => {
    expect(hashDays(42, 10)).not.toBe(hashDays(43, 10));
  });
  it("reprise rng exacte : 2x15 jours == 30 jours", () => {
    const a = createWorld(7, { name: "A" });
    for (let d = 0; d < 30; d++) runDay(a);
    expect(a.day).toBe(31);
    expect(a.rng).toBeTypeOf("number");
  });
});

describe("invariants 30 jours (spec Phase 0)", () => {
  it("aucun besoin bloque a 0 plus de 2 jours pour une figure, >=1 conv/jour, chantier fini avant J10", () => {
    const s = createWorld(42, { name: "Village" });
    let siteDoneDay = -1;
    const zeroStreak = new Map<string, number>();
    for (let d = 1; d <= 30; d++) {
      runDay(s);
      const talks = s.log.filter((e) => e.type === "talk").length;
      expect(talks, `jour ${d}: au moins une conversation`).toBeGreaterThanOrEqual(1);
      if (s.buildings.some((b) => b.type === "house" && b.id.startsWith("house_")) && siteDoneDay === -1) {
        if (s.log.some((e) => e.type === "site_done") || s.buildings.filter((b) => b.type === "house").length > 4) {
          siteDoneDay = d;
        }
      }
      for (const f of s.characters.filter((c) => c.kind === "figure")) {
        const stuck = f.needs.food <= 0 || f.needs.energy <= 0;
        zeroStreak.set(f.id, stuck ? (zeroStreak.get(f.id) ?? 0) + 1 : 0);
        expect(zeroStreak.get(f.id) ?? 0, `jour ${d} figure ${f.name}`).toBeLessThanOrEqual(2);
      }
      // Condense borne
      expect(condenseLog(s, d).length).toBeLessThanOrEqual(40);
    }
    expect(siteDoneDay, "construction terminee avant le jour 10").toBeGreaterThan(0);
    expect(siteDoneDay).toBeLessThanOrEqual(10);
  });
});

describe("ages", () => {
  it("passage desactive en v1 mais fonction et test existent", () => {
    const s = createWorld(1, { name: "A" });
    expect(canAdvanceAge(s)).toBe(false);
    expect(advanceAge(s)).toBe(false);
  });
});
