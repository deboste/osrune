# Rapport Phase 1 (2026-09-03)

1. Base Supabase `osrune` (eu-west-3) : 4 tables + RLS, migrations Drizzle + `supabase db push`.
2. Rattrapage (`@osrune/catchup`) : claim atomique, max 8 appels (7 + 1 resume), pause au-dela de 30 j.
3. Criteres : creation 1 appel + rejouabilite OK ; 5 j en ~2 s (< 25 s) ; 40 j = 7 + 1 resume, 8 appels max ; concurrence = 1 seul run ; budget 0 = gabarit + over_budget, moteur intact.
4. API Next.js (8 routes, spec 10) : e2e valide avec vrai utilisateur (creation, avance dev, decision 1/j, ajout filtre, jours, usage, 401 sans jeton, cycle 202 -> done -> vue).
5. Couts : gabarit = 0 ; modele reel non teste ici (pas de cle OpenRouter) : taux JSON 95 % a mesurer.
6. Ecarts : ADR-005 (claim, pas advisory), ADR-006 (compaction differee, creation offerte), ADR-007 (fond flottant + debit memoire en dev).
7. Infra notee : pooler officiel `aws-1-eu-west-3` (le `aws-0` documente partout ne route pas ce projet) ; node repare via `brew reinstall merve`.
8. Prochain pas : cle OpenRouter -> test 50 j modele, puis Phase 2 (canvas + film du jour, maquette a verser).
