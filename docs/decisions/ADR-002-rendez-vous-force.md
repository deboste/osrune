# ADR-002 : rituels sociaux (dejeuner, veillee) + filets, pas de teleportation

Date : 2026-09-03. Statut : accepte (remplace le rendez-vous marche 12h/18h).

Contexte : la spec garantit "au moins une conversation de figures par jour" mais en mode
serveur (tuiles) les personnages disperses ne se rencontrent jamais. Trois tentatives ecartees :
marche force (les marcheurs interceptes n'arrivaient jamais au chantier), appariement direct
(les paires proches etaient toujours bordeaux sur un besoin), filet du soir seul (travailleurs
epuises a 20h).

Decision : deux rituels quotidiens + deux filets, tout en deterministe (`state.rng`) :
- 13h (tick 25), dejeuner : les figures (sauf epuisees < 15, endormies, deja a table) gagnent
  la halle pour manger. Meme les affamees viennent : le dejeuner EST leur repas.
- Attarde post-repas : 60 % de chance de flaner 5 ticks apres manger, la que naissent les causeries.
- 20h30 (tick 41), veillee : meme appel a la halle (diner si faim < 45, sinon veiller), si
  aucune conversation journalisee ce jour.
- Filets tick 33 (paires a <= 6) et 45 (<= 12) : appariement direct des deux figures valides
  les plus proches si le journal reste vide.
- Garde-fous conserves : jamais de discussion pour affame/epuise (sauf a table), jamais
  d'interruption du sommeil/repas/marche, spontanes strictement entre semblables.

Consequence : l'invariant tient sur 30 jours pour 6 seeds testees (1, 2, 3, 42, 99, 1234).
Cout : ~1h de travail figure/jour convertie en vie sociale. Assumer cote recit : le village
dejeune et veille ensemble, c'est une qualite, pas un hack.
