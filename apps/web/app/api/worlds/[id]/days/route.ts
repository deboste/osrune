import { and, asc, eq, gte, lte } from "drizzle-orm";
import { dayLogs, worlds } from "@osrune/db";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const owner = await dbi().select().from(worlds).where(eq(worlds.id, id)).limit(1);
    if (!owner[0] || owner[0].ownerId !== uid) {
      return Response.json({ error: { code: "world_not_found", message: "Monde introuvable." } }, { status: 404 });
    }
    const url = new URL(req.url);
    const from = Number(url.searchParams.get("from") ?? 1);
    const to = Number(url.searchParams.get("to") ?? from + 6);
    const logs = await dbi()
      .select()
      .from(dayLogs)
      .where(and(eq(dayLogs.worldId, id), gte(dayLogs.day, from), lte(dayLogs.day, to)))
      .orderBy(asc(dayLogs.day));
    return Response.json({
      days: logs.map((l) => ({
        day: l.day,
        condensed: l.condensed,
        chronicle: l.chronicle,
        decision: l.decision,
        decisionAnswer: l.decisionAnswer,
        source: l.source,
        modelId: l.modelId,
        tokensIn: l.tokensIn,
        tokensOut: l.tokensOut,
        costCents: Number(l.costCents),
      })),
    });
  } catch (e) {
    return err(e);
  }
}
