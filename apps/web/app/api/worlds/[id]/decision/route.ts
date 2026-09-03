import { answerDecision } from "@osrune/catchup";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { option?: number };
    const r = await answerDecision(dbi(), { worldId: id, userId: uid, option: Number(body.option) });
    return Response.json({ ok: true, effects: r.effects });
  } catch (e) {
    return err(e);
  }
}
