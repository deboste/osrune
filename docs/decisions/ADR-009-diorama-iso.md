# ADR-009 : diorama iso procedural, pas d'assets externes

Date : 2026-09-03. Statut : accepte.

Contexte : la page demo en grille de divs ne donne envie a personne. Le proprietaire
exige une carte 2D-HD avec perspective, vrais batiments, personnages, relief, textures.
Pistes explorees : packs Kenney CC0 (ville moderne, pas medievale ; echelles incoherentes
entre packs), packs itch.io (payants ou sans personnages animes). Impasse temps/qualite.

Decision : diorama isometrique 100 % procedural, style flat HD coherent
(`apps/web/lib/iso/`, `components/IsoMap.tsx`) :
- Blocs de relief (flancs terre, surplomb varie), eau animee, sable, herbe nuancee,
  champs onduleux, chemins, pins, touffes, fleurs.
- Batiments dessines (chaume strie, colombages, halle aux bannieres, marche a auvent
  raye + brasier, chantier qui pousse avec le %, epouvantail), fumee de cheminee.
- Villageois modules (tunique de metier, cheveux, outils), marche/travail/parole/sommeil,
  etiquettes des figures, bulles de repliques, fiche au clic (lecture seule, spec 8).
- Ciel (collines, nuages, etoiles), cycle jour/nuit sur l'heure reelle, Use the traffic lights.
  lucioles, oiseaux, ombres portees, vignettage. `prefers-reduced-motion` respecte.
- Moteur `@osrune/engine` en presentation dans le navigateur (vie ambiante, rien persiste).
- Film du jour : camera sur les lieux de la chronique + cartons (bouton de la demo).

Consequence : zero dependance d'assets, zero licence, deterministe, ~115 ko JS.
La maquette `maquette-civilisation-agents-v3.html` n'est plus attendue : cette direction
la remplace (spec 9.2 adaptee : Canvas 2D natif garde, sprites rectangles abandonnes).
A faire en Phase 2 : son, saison, zoom tactile pince, test 60 fps sur telephone reel.
