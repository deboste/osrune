import { createWorldRow } from "@osrune/catchup";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const body = (await req.json().catch(() => ({}))) as { name?: string; prompt?: string };
    const name = String(body.name ?? "").slice(0, 40);
    if (name.length < 2) {
      return Response.json({ error: { code: "bad_name", message: "Nom de monde trop court." } }, { status: 400 });
    }
    const row = await createWorldRow(dbi(), {
      ownerId: uid,
      name,
      ...(body.prompt ? { userPrompt: String(body.prompt).slice(0, 300) } : {}),
    });
    return Response.json({ world: { id: row.id, name: row.name, day: row.day, seed: row.seed } }, { status: 201 });
  } catch (e) {
    return err(e);
  }
}
