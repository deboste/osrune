import { computeMissedDays, dayLengthHours, runCatchup, worldView } from "@osrune/catchup";
import { dbi, chroniclers, err, rate, userId } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const uid = await userId(req);
    rate(uid);
    const { id } = await ctx.params;
    const view = await worldView(dbi(), id, uid);
    if (view.world.catchup.status === "running") {
      return Response.json(
        { status: "running", currentDay: view.world.catchup.current, totalDays: view.world.catchup.total },
        { status: 202 },
      );
    }
    const hours = dayLengthHours(view.world.tier);
    const missed = computeMissedDays(new Date(view.world.lastSimulatedAt), new Date(), hours);
    if (missed >= 1 && view.world.status !== "paused") {
      // Tache de fond : le client interroge /catchup (spec 6.3). Prod : file dediee (ADR-007).
      void runCatchup(dbi(), { worldId: id, userId: uid, ...chroniclers }).catch((e) => console.error("catchup", e));
      return Response.json({ status: "running", missedDays: missed }, { status: 202 });
    }
    return Response.json({ status: view.world.status === "paused" ? "paused" : "idle", missedDays: missed, view });
  } catch (e) {
    return err(e);
  }
}
