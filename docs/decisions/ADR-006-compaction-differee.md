# ADR-006 : compaction des memoires differee, creation non facturee

Date : 2026-09-03. Statut : accepte (dette documentee, pas oubliee).

Contexte : la spec 7.6 prevoit une compaction des resumes toutes les 7 journees (1 appel/monde)
et la 9.1 un appel de creation des figures. Les deux comptent dans le budget.

Decision Phase 1 :
- Compaction : NON implementee. Les faits sont plafonnes a 10/figure (FIFO) et les resumes
  ne bougent pas, donc le prompt reste borne (~+400 tokens pire cas). La compaction arrive
  avec le tableau de bord des couts (Phase 3), quand on pourra mesurer son apport qualite.
- Creation : l'appel `createFigures` est fait (qualite des fiches jour 1) mais facture 0.
  Ordre de grandeur : ~0,05 ct, negligeable devant les 15 ct du palier gratuit. Il sera
  journalise en Phase 3.

Consequence : ecart assume a la spec, sans impact sur les plafonds (le plafond mensuel reste
largement protecteur : 15 ct >> ~0,5 ct/mois pour un joueur quotidien au tarif constate).
