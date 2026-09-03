import { addPlayerText } from "@osrune/catchup";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { text?: string };
    await addPlayerText(dbi(), { worldId: id, userId: uid, text: String(body.text ?? "") });
    return Response.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
