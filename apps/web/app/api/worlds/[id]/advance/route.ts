import { advanceOneDay } from "@osrune/catchup";
import { dbi, chroniclers, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    if (process.env["NODE_ENV"] === "production") {
      return Response.json({ error: { code: "forbidden", message: "Reserve au developpement." } }, { status: 403 });
    }
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const day = await advanceOneDay(dbi(), { worldId: id, userId: uid, ...chroniclers });
    return Response.json({ ok: true, day });
  } catch (e) {
    return err(e);
  }
}
