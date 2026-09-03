# OSRune

Jeu web : un monde 2D pixel art peuple d'agents autonomes. Le joueur part, le monde vit (moteur deterministe), le joueur revient, lit la chronique (LLM, 1 appel/jour), regarde le film, decide, repart.

Spec : `docs/spec.md` (v0.1). Maquette visuelle `maquette-civilisation-agents-v3.html` : **non fournie dans ce depot** (a verser avant la Phase 2).

## Principes

1. Simulation paresseuse (rattrapage au retour, plafond 30 j, 8 appels LLM max).
2. Corps deterministe, tete rare (moteur sans LLM + chroniqueur 1x/jour).
3. Figures (5, fiche riche) et figurants (7, corps seul).
4. Cout borne (budget/monde, gabarit si depassement, jamais de coupure moteur).

## Monorepo (pnpm workspaces, TypeScript strict)

- `packages/engine` : moteur pur, zero IO, zero `Date.now`/`Math.random`. API : `createWorld`, `tick`, `runDay`, `condenseLog`, `applyEffects`, `snapshot`.
- `packages/chronicler` : prompts, schema Zod, client OpenRouter (`response_format json_object`, 1 retry), gabarit offline, tokens/couts.
- `packages/content` : donnees par age (`fire` livre, `steam/orbital/oblivion` verrouilles mais types).
- `packages/shared` : schemas Zod (source unique), constantes.
- `packages/db` : Phase 1 (schema Drizzle + migrations, RLS).
- `packages/catchup` : Phase 1 (rattrapage, budgets, decisions, ajouts).
- `apps/cli` : `osrune sim --days 30 --seed 42 [--offline]`.
- `apps/web` : Phase 1 (API REST, spec 10), front en Phase 2.

## Phase 0 : moteur en texte pur

```bash
pnpm install
pnpm --filter @osrune/engine test
pnpm --filter @osrune/chronicler test
pnpm --filter @osrune/cli start -- sim --days 30 --seed 42 --offline
# Avec modele (cout reel) :
# OPENROUTER_API_KEY=... pnpm --filter @osrune/cli start -- sim --days 3 --seed 42
```

Criteres : determinisme (hash), invariants 30 j (besoins, >=1 conv/j, chantier < J10), gabarit offline, tokens imprimes/appel (<2500 in, <500 out).

## Decisions (ADR)

Voir `docs/decisions/`. Ecarts a la spec documentes, jamais silencieux.
