# ADR-003 : effets de decision adresses par ids stables, pas par noms

Date : 2026-09-03. Statut : accepte.

Contexte : la spec (7.2) propose des effets `relation` avec `id: "NomA:NomB"`. Les noms francais (espaces, accents, renommage a la creation) rendent l'appariement fragile et le schema Zod ne peut pas les valider sans la liste des figures.

Decision : a l'interieur du moteur, les relations sont adressees par `"fig_1:fig_3"`. Le chroniqueur recoit la consigne d'emettre des ids ressources (`food|wood|goods`) ou relation (`fig_X:fig_Y`), avec la table de correspondance dans le prompt stable (noms + ids). La validation rejette tout effet hors bornes ou a cible inconnue, sans erreur (effet ignore + journalise en Phase 1).

Consequence : ecart mineur a la spec, sans impact produit. Le prompt Phase 0 inclura la table id->nom.
