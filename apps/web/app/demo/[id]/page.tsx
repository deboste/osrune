// Page demo publique (validation uniquement) : lecture seule d'un monde, sans login.
// A securiser ou supprimer en Phase 2 (front authentifie).
import { eq } from "drizzle-orm";
import { worlds, dayLogs, characters } from "@osrune/db";
import { rowToState } from "@osrune/catchup";
import { dbi } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TILE_BG: Record<string, string> = {
  W: "#3b82c4",
  S: "#e8d8a0",
  F: "#2d6a35",
  ".": "#7cbf6a",
  "~": "#c9a94e",
  P: "#b99a67",
};

const BUILDING_MARK: Record<string, { t: string; bg: string }> = {
  hall: { t: "H", bg: "#8b5a2b" },
  market: { t: "M", bg: "#c47b2b" },
  house: { t: "h", bg: "#a9713f" },
  site: { t: "C", bg: "#888888" },
  field: { t: "F", bg: "#c9a94e" },
  forest: { t: "T", bg: "#2d6a35" },
};

export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await dbi().select().from(worlds).where(eq(worlds.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.name !== "Vallée des Brumes") {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
        <h1>Démo introuvable</h1>
        <p>Ce lien de validation n'existe pas (ou plus).</p>
      </main>
    );
  }
  const state = rowToState(row);
  const chars = await dbi().select().from(characters).where(eq(characters.worldId, id));
  const logs = await dbi().select().from(dayLogs).where(eq(dayLogs.worldId, id)).orderBy(dayLogs.day).limit(30);
  const { cols, rows: nrows, tiles } = state.map;
  const cells = [];
  for (let r = 0; r < nrows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r * cols + c] ?? ".";
      const b = state.buildings.find((x) => x.c === c && x.r === r);
      const people = state.characters.filter((x) => x.pos.c === c && x.pos.r === r);
      const mark = b ? BUILDING_MARK[b.type] : null;
      cells.push(
        <div
          key={`${c}-${r}`}
          title={b ? `${b.type} ${b.id}` : people.map((p) => p.name).join(", ") || t}
          style={{
            width: 22,
            height: 22,
            background: mark?.bg ?? TILE_BG[t] ?? "#7cbf6a",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            position: "relative",
          }}
        >
          {mark?.t ?? ""}
          {people.length > 0 && (
            <span
              style={{
                position: "absolute",
                right: 1,
                bottom: 1,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: people[0]?.kind === "figure" ? "#ff3b30" : "#fff",
                border: "1px solid #000",
              }}
            />
          )}
        </div>,
      );
    }
  }
  const withChronicle = logs.filter((l) => l.chronicle).slice(-5).reverse();
  const pending = [...logs].reverse().find((l) => l.decision && !l.decisionAnswer);
  const period = (() => {
    for (const l of withChronicle) {
      const c = l.chronicle as { period?: { from: number; to: number; resume: string } } | null;
      if (c?.period) return c.period;
    }
    return null;
  })();
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#666", fontSize: 13 }}>OSRune — lien de validation (lecture seule, monde de démo)</p>
      <h1 style={{ margin: "0.2rem 0" }}>{row.name}</h1>
      <p>
        Jour {row.day} · Âge du Feu · 🌾 {Math.round(state.resources.food)} 🪵 {Math.round(state.resources.wood)} 🏺{" "}
        {Math.round(state.resources.goods)}
      </p>
      <h2>Carte</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 22px)`, gap: 2 }}>{cells}</div>
      <p style={{ fontSize: 12, color: "#666" }}>
        H halle · M marché · h maison · C chantier · F champ · T forêt · <span style={{ color: "#ff3b30" }}>●</span>{" "}
        figure · <span>○</span> figurant
      </p>
      <h2>Chronique (5 derniers jours)</h2>
      {period && (
        <p style={{ background: "#f5f0e6", padding: "0.6rem", borderRadius: 8 }}>
          <b>Les jours {period.from} à {period.to} en bref.</b> {period.resume}
        </p>
      )}
      {withChronicle.length === 0 && <p>Aucune chronique pour l'instant.</p>}
      {withChronicle.map((l) => (
        <section key={l.day} style={{ borderTop: "1px solid #ddd", padding: "0.6rem 0" }}>
          <b>Jour {l.day}</b> <span style={{ color: "#888", fontSize: 12 }}>({l.source})</span>
          {((l.chronicle as { chronique?: { texte: string }[] } | null)?.chronique ?? []).map((e, k) => (
            <p key={k} style={{ margin: "0.3rem 0" }}>
              {e.texte}
            </p>
          ))}
        </section>
      ))}
      {pending && (
        <>
          <h2>Décision en attente (jour {(pending.decision as { day?: number } | null) ? pending.day : pending.day})</h2>
          {(() => {
            const d = pending.decision as { titre: string; texte: string; options: { label: string }[] };
            return (
              <div style={{ background: "#eef4ff", padding: "0.8rem", borderRadius: 8 }}>
                <b>{d.titre}</b>
                <p>{d.texte}</p>
                <ul>
                  {d.options.map((o) => (
                    <li key={o.label}>{o.label}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </>
      )}
      <h2>Habitants (figures)</h2>
      {chars
        .filter((c) => c.kind === "figure")
        .map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid #eee", padding: "0.4rem 0" }}>
            <b>{c.name}</b> · {c.role} · {c.traits.join(", ")}
            <br />
            <span style={{ color: "#555", fontSize: 14 }}>{c.goal}</span>
            {c.quote && (
              <>
                <br />
                <i>« {c.quote} »</i>
              </>
            )}
          </div>
        ))}
    </main>
  );
}
