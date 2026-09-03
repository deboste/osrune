# ADR-001 : moteur sans dependance runtime, Zod aux frontieres

Date : 2026-09-03. Statut : accepte.

Contexte : la spec exige a la fois "moteur pur, zero dependance runtime" et "Zod source unique des schemas".

Decision : le moteur (`@osrune/engine`) ne depend a l'execution que de `@osrune/content` (tables de donnees, pas d'IO). Les types sont dupliques en `import type` (effaces a la compilation). La validation Zod (`@osrune/shared`) a lieu aux frontieres : persistance, API, chroniqueur, CLI.

Consequence : deux definitions de types a maintenir (moteur + shared). Un test de conformite sera ajoute en Phase 1 (snapshot Zod du `WorldState` moteur).
