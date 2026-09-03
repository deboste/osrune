import { readFileSync, existsSync } from "node:fs";

const REF = "bxtcfspkgrruidszbhva";
const POOLER = "aws-1-eu-west-3.pooler.supabase.com";

/** DATABASE_URL prioritaire, sinon mot de passe du ~/.env de l'utilisateur. */
export function loadDbUrl(): string {
  if (process.env["DATABASE_URL"]) return process.env["DATABASE_URL"] as string;
  const home = process.env["HOME"] ?? "/Users/etienne.debost";
  const f = `${home}/.env`;
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^SUPABASE_OSRUNE_DATABASE_PASSWORD=(.*)$/);
      if (m) {
        const pw = (m[1] ?? "").trim().replace(/^["']|["']$/g, "");
        return `postgresql://postgres.${REF}:${encodeURIComponent(pw)}@${POOLER}:6543/postgres`;
      }
    }
  }
  throw new Error("DATABASE_URL ni SUPABASE_OSRUNE_DATABASE_PASSWORD trouves");
}
