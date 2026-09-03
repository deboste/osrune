# apps/web — API Phase 1 livree, front en Phase 2

API (spec 10) : `POST /api/worlds`, `GET /api/worlds/:id` (declenche le rattrapage, 202 si
en cours), `GET /:id/catchup`, `GET /:id/days?from&to`, `POST /:id/decision`, `POST /:id/add`,
`POST /:id/advance` (hors prod), `GET /api/me/usage`. Auth Bearer Supabase, 60 req/min.

Dev : copier les cles dans `apps/web/.env.local` (gitignore), `pnpm --filter @osrune/web exec next dev`.

Ecrans : connexion, creation, retour (rattrapage), monde (carte + Chronique/Habitants/Creer), film du jour.
Rendu : Canvas 2D natif, moteur `@osrune/engine` en mode `presentation` (cosmetique, rien persiste).

Pre-requis avant d'ecrire le front : verser `maquette-civilisation-agents-v3.html` dans `docs/` (reference visuelle manquante) + trancher les 5 questions ouvertes de la spec (defauts proposes : OSRune, renommage a la creation, pas de mort, FR seul, email+Google).
