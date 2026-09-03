"use client";
// Habillage client de la demo : carte + fiche + film + chronique.
import { useMemo, useState } from "react";
import IsoMap, { type FilmShot } from "@/components/IsoMap";
import { normChronicle } from "@osrune/shared";
import type { Character, WorldState } from "@osrune/engine";

interface DayItem {
  day: number;
  chronicle: unknown;
  decision: unknown;
  source: string;
}

interface Props {
  worldName: string;
  day: number;
  resources: { food: number; wood: number; goods: number };
  state: WorldState;
  days: DayItem[];
  pending: { day: number; decision: { titre: string; texte: string; options: { label: string }[] } } | null;
  period: { from: number; to: number; resume: string } | null;
}

export default function DemoClient({ worldName, day, resources, state, days, pending, period }: Props) {
  const [selected, setSelected] = useState<Character | null>(null);
  const [film, setFilm] = useState<FilmShot[] | null>(null);

  const shots = useMemo<FilmShot[]>(() => {
    const last = days[days.length - 1];
    if (!last) return [];
    return normChronicle(last.chronicle).map((e) => ({ lieu: e.lieu, texte: e.texte }));
  }, [days]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#666", fontSize: 13, margin: "0.4rem 0 0" }}>OSRune — lien de validation (lecture seule)</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.8rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: "0.2rem 0" }}>{worldName}</h1>
        <span style={{ color: "#555" }}>
          Jour {day} · 🌾 {resources.food} 🪵 {resources.wood} 🏺 {resources.goods}
        </span>
        <button
          onClick={() => shots.length > 0 && setFilm(shots)}
          disabled={shots.length === 0 || film !== null}
          style={{
            marginLeft: "auto",
            padding: "0.5rem 1rem",
            borderRadius: 999,
            border: "none",
            background: film !== null ? "#999" : "#1c1c22",
            color: "#fff",
            cursor: shots.length === 0 || film !== null ? "default" : "pointer",
          }}
        >
          {film !== null ? "Film en cours…" : "▶ Film du jour"}
        </button>
      </div>

      <div
        style={{
          position: "relative",
          height: "52vh",
          minHeight: 380,
          borderRadius: 16,
          overflow: "hidden",
          marginTop: "0.6rem",
          boxShadow: "0 12px 40px rgba(10,20,40,0.35)",
        }}
      >
        <IsoMap
          state={state}
          film={film}
          onSelect={setSelected}
          onFilmEnd={() => setFilm(null)}
          selectedId={selected?.id ?? null}
        />
      </div>
      <p style={{ fontSize: 12, color: "#666" }}>Glisser : panoramique · Molette : zoom · Clic sur un villageois : fiche</p>

      {selected && (
        <section style={{ background: "#f6f1e6", borderRadius: 12, padding: "0.8rem 1rem", marginTop: "0.4rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "baseline" }}>
            <b style={{ fontSize: 18 }}>{selected.name}</b>
            <span style={{ color: "#555" }}>
              {selected.role} · {selected.ageYears} ans · {selected.traits.join(", ")}
            </span>
            <button
              onClick={() => setSelected(null)}
              style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", fontSize: 16 }}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "0.3rem 0" }}>{selected.goal}</p>
          {selected.quote && (
            <p style={{ margin: "0.3rem 0" }}>
              <i>« {selected.quote} »</i>
            </p>
          )}
          <div style={{ display: "flex", gap: "1rem", fontSize: 13 }}>
            <span>🥖 {Math.round(selected.needs.food)}</span>
            <span>⚡ {Math.round(selected.needs.energy)}</span>
            <span>💬 {Math.round(selected.needs.social)}</span>
            <span style={{ color: "#777" }}>{selected.state === "sleep" ? "dort" : selected.state === "work" ? "travaille" : selected.state === "talk" ? "discute" : selected.state === "eat" ? "mange" : "flâne"}</span>
          </div>
        </section>
      )}

      <h2>Chronique (5 derniers jours)</h2>
      {period && (
        <p style={{ background: "#f5f0e6", padding: "0.6rem", borderRadius: 8 }}>
          <b>
            Les jours {period.from} à {period.to} en bref.
          </b>{" "}
          {period.resume}
        </p>
      )}
      {days
        .slice(-5)
        .reverse()
        .map((l) => (
          <section key={l.day} style={{ borderTop: "1px solid #ddd", padding: "0.6rem 0" }}>
            <b>Jour {l.day}</b> <span style={{ color: "#888", fontSize: 12 }}>({l.source})</span>
            {normChronicle(l.chronicle).map((e, k) => (
              <p key={k} style={{ margin: "0.3rem 0" }}>
                {e.texte}
              </p>
            ))}
          </section>
        ))}

      {pending && (
        <section style={{ background: "#eef4ff", padding: "0.8rem", borderRadius: 8, marginTop: "0.6rem" }}>
          <b>Décision en attente (jour {pending.day}) — {pending.decision.titre}</b>
          <p>{pending.decision.texte}</p>
          <ul>
            {pending.decision.options.map((o) => (
              <li key={o.label}>{o.label}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
