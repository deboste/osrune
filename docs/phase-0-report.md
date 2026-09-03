# Rapport Phase 0 (2026-09-03)

1. Moteur deterministe livre (`@osrune/engine`, zero IO) : double run seed 42 = meme hash.
2. Invariants 30 j OK sur 6 seeds : besoins jamais bloques > 2 j, >= 1 conv figures/j, chantier fini J1-J4.
3. Chroniqueur (`@osrune/chronicler`) : schema Zod strict, `response_format json_object`, 1 retry, gabarit.
4. CLI `osrune sim --days 30 --seed 42 [--offline]` : 30 j sans erreur, tokens imprimes par jour.
5. Couts mesures : ~870 in / 180 out par jour (gabarit), ~0,01 ct/j ; cible spec (< 2500/500) tenue.
6. Manque la mesure modele reelle a 95 % (pas de cle ici) : a jouer avant Phase 1, sinon fallback Qwen.
7. Ecarts : ADR-001 (Zod aux frontieres), ADR-002 (rituels), ADR-003 (effets par ids), ADR-004 (modele).
8. Non fait : `replay`/`cost` CLI, web, DB (scaffolds + README), maquette absente (bloque Phase 2).
9. Prochain pas : cle OpenRouter, test 50 j modele, puis Phase 1 (Supabase, rattrapage, verrou).
