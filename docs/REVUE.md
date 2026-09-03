# Revue + challenge de la spec v0.1 (2026-09-03)

Verdict : spec solide et implementable. Les 4 principes (paresse, corps deterministe, figures/figurants, cout borne) tiennent. Phase 0 implementee dans ce depot. 12 points de challenge ci-dessous, dont 4 ecarts assumes avec ADR.

## Ce qui est bon
- Separation corps/tete : le cout marginal/jour (~0,03 ct avec DeepSeek V3 debut sept. 2026) rend le gratuit a 15 ct/mois credible.
- Plafond 8 appels/rattrapage + gabarit : l'economie est bornee par construction.
- Seed + rng porte par l'etat : la reprise exacte est possible sans journal d'ops.

## Challenge (par risque decroissant)
1. Maquette absente. Le depot ne contient pas `maquette-civilisation-agents-v3.html`. Phase 0 faite sans elle ; Phase 2 bloquee tant qu'elle n'est pas versee dans `docs/`.
2. "95% JSON valide au 1er essai" : intenable en texte libre. Impose `response_format json_object` + retry avec erreur Zod (fait) ; a mesurer sur 50 jours reels.
3. Compaction memoires oubliee du plafond "8 appels". Comptee desormais (voir db/README).
4. Effets `relation` adresses par noms ("NomA:NomB") : fragile (accents, renommage). Ecart ADR-003 : ids stables `fig_X:fig_Y`, table id->nom dans le prompt.
5. Rencontres : sans forçage, 0 conversation/jour possible en mode serveur. Ecart ADR-002 : rendez-vous marche 12h/18h (marche, pas teleportation).
6. Moteur "zero dependance" vs `content[age]` obligatoire : tranche ADR-001 (content = donnees, pas IO ; Zod aux frontieres).
7. `characters` duplique `state.characters` : ecrivain unique = fin de rattrapage, sinon divergence assuree.
8. `DAY_LENGTH` par palier : figer le tier au debut du rattrapage, sinon un upgrade mid-absence fausse `missedDays`.
9. Filtre insultes statique : OK v1, mais prevoir faux positifs FR + contournement par translitteration. Pas de LLM de moderation en v1 (choix cout assume).
10. `state` "compresse si > 200 ko" : premature (etat ~30-50 ko). Ne pas implementer en Phase 1, mesurer d'abord.
11. Film 10 s / 60 fps milieu de gamme : a budgeter en Phase 2 (canvas natif OK a priori pour 12 sprites, mais a profiler avec `prefers-reduced-motion`).
12. Questions ouvertes §13 : appliquer les defauts si pas de reponse avant Phase 2 (OSRune, renommage creation, pas de mort, FR seul, email+Google).

## Reponses proposees au §13
1. OSRune, monde nomme par le joueur. 2. Renommage figures a la creation uniquement. 3. Pas de mort en v1. 4. Francais seul, structure prete pour l'anglais. 5. Email + Google.
