# ADR-005 : exclusion mutuelle du rattrapage par claim atomique (pas de verrou consultatif)

Date : 2026-09-03. Statut : accepte.

Contexte : la spec 6.2 propose `pg_advisory_xact_lock` OU une colonne `catchup_started_at`
avec expiration. Le pooler Supabase (Supavisor, mode transaction) rend les verrous de session
fragiles, et il faut de toute facon des colonnes pour la progression visible.

Decision : claim atomique `UPDATE ... WHERE (catchup_status IN ('idle','done') OR
catchup_started_at < now() - 2 min)`. 1 ligne mise a jour = elu, 0 = un autre tourne (202 +
progression). La meme ecriture porte `catchup_total/current` pour le polling. Expiration 2 min
en cas de crash. Colonnes : `catchup_status/current/total/started_at` sur `worlds`.

Consequence : pas de verrou PG, compatible pooler, un seul aller-retour. Le test de
concurrence (2 requetes simultanees, 5 j) donne done + running avec 5 appels modele au total.
