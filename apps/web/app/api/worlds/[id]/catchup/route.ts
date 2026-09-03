import { eq } from "drizzle-orm";
import { worlds } from "@osrune/db";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const rows = await dbi().select().from(worlds).where(eq(worlds.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.ownerId !== uid) {
      return Response.json({ error: { code: "world_not_found", message: "Monde introuvable." } }, { status: 404 });
    }
    return Response.json({
      status: row.catchupStatus,
      currentDay: row.catchupCurrent,
      totalDays: row.catchupTotal,
    });
  } catch (e) {
    return err(e);
  }
}
