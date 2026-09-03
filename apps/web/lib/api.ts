// Helpers partages des routes API : auth, debit, erreurs, chroniquer cable (spec 10, 11.2).

import { createClient } from "@supabase/supabase-js";
import { getDb, loadDbUrl, type Db } from "@osrune/db";
import { HttpError, dayLengthHours, computeMissedDays } from "@osrune/catchup";
import { writeDay, writePeriod } from "@osrune/chronicler";

let db: Db | null = null;
export function dbi(): Db {
  if (!db) db = getDb(loadDbUrl());
  return db;
}

/** Authentifie le porteur Supabase, retourne l'uuid. */
export async function userId(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer (.+)$/);
  if (!m) throw new HttpError(401, "unauthorized", "Jeton manquant.");
  const url = process.env["SUPABASE_URL"];
  const anon = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anon) throw new HttpError(500, "config", "Supabase non configure.");
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${m[1] as string}` } } });
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Jeton invalide.");
  return data.user.id;
}

const hits = new Map<string, number[]>();

/** 60 requetes/min/utilisateur (memoire process : voir ADR-007 pour le multi-instance). */
export function rate(user: string): void {
  const now = Date.now();
  const arr = (hits.get(user) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 60) throw new HttpError(429, "rate_limited", "Trop de requetes.");
  arr.push(now);
  hits.set(user, arr);
}

export function err(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: { code: "internal", message: "Erreur interne." } }, { status: 500 });
}

export const chroniclers = {
  chroniclerDay: (i: Parameters<typeof writeDay>[0]) => writeDay(i),
  chroniclerPeriod: (i: Parameters<typeof writePeriod>[0]) => writePeriod(i),
};

export { dayLengthHours, computeMissedDays };
