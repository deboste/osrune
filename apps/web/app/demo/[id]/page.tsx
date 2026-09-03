// Page demo publique (validation uniquement) : monde reel + carte iso HD.
import { eq } from "drizzle-orm";
import { worlds, dayLogs } from "@osrune/db";
import { rowToState } from "@osrune/catchup";
import { dbi } from "@/lib/api";
import DemoClient from "@/components/DemoClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const logs = await dbi().select().from(dayLogs).where(eq(dayLogs.worldId, id)).orderBy(dayLogs.day).limit(30);
  const withChronicle = logs.filter((l) => l.chronicle);
  const pendingRow = [...logs].reverse().find((l) => l.decision && !l.decisionAnswer);
  let period: { from: number; to: number; resume: string } | null = null;
  for (const l of withChronicle) {
    const c = l.chronicle as { period?: { from: number; to: number; resume: string } } | null;
    if (c?.period) {
      period = c.period;
      break;
    }
  }
  return (
    <DemoClient
      worldName={row.name}
      day={row.day}
      resources={{
        food: Math.round(state.resources.food),
        wood: Math.round(state.resources.wood),
        goods: Math.round(state.resources.goods),
      }}
      state={JSON.parse(JSON.stringify(state)) as typeof state}
      days={withChronicle.map((l) => ({ day: l.day, chronicle: l.chronicle, decision: l.decision, source: l.source }))}
      pending={
        pendingRow
          ? {
              day: pendingRow.day,
              decision: pendingRow.decision as { titre: string; texte: string; options: { label: string }[] },
            }
          : null
      }
      period={period}
    />
  );
}
