import { eq } from "drizzle-orm";
import { worlds } from "@osrune/db";
import { tierBudget } from "@osrune/catchup";
import { dbi, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const rows = await dbi().select().from(worlds).where(eq(worlds.ownerId, uid));
    return Response.json({
      worlds: rows.map((w) => ({
        id: w.id,
        name: w.name,
        tier: w.tier,
        status: w.status,
        spentCentsMonth: Number(w.spentCentsMonth ?? 0),
        budgetCentsMonth: Number(w.budgetCentsMonth ?? tierBudget(w.tier)),
      })),
    });
  } catch (e) {
    return err(e);
  }
}
