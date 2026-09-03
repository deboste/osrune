# ADR-007 : tache de fond et debit en Phase 1 (dev) vs production

Date : 2026-09-03. Statut : accepte.

Contexte : la spec 6.3 veut une tache de fond + polling, et la 10 un debit de 60 req/min.
En production serverless, une promesse flottante dans une route peut etre gelee.

Decision Phase 1 :
- La route `GET /api/worlds/:id` lance `runCatchup` sans attendre (promesse flottante,
  erreurs loggees) et repond 202. Valide en dev/`next start` et sur tout serveur Node
  longue duree. En production serverless, brancher une file (pg-boss, Inngest, ou worker
  dedie) SANS changer le contrat : claim + colonnes de progression sont deja concus pour.
- Debit : seau a jetons en memoire process (60/min/utilisateur). Valide en mono-instance.
  En multi-instance, passer sur un compteur Redis/DB.

Consequence : aucun changement de contrat API le jour du passage a l'echelle.
