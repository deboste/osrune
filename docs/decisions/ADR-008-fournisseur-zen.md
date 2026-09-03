# ADR-008 : fournisseur Zen (OpenCode) en option, OpenRouter par defaut

Date : 2026-09-03. Statut : accepte, validation qualitative en attente de quota.

Contexte : la spec 3.2 impose OpenRouter. Le proprietaire veut aussi OpenCode Zen
(gratuit). Les deux exposent `/chat/completions` OpenAI-compatible.

Decision :
- `packages/chronicler/src/provider.ts` : `CHRONICLER_PROVIDER=openrouter|zen`,
  `CHRONICLER_BASE_URL` (defaut `https://opencode.ai/zen/v1`), cle `ZEN_API_KEY`
  (ou `OPENCODE_ZEN_API_KEY`), modeles par env. `writeDay/writePeriod/createFigures`
  passent par la : aucun changement d'appelants.
- Defaut spec inchange (openrouter). Config proprietaire (`.env`, gitignore) : Zen,
  `mimo-v2.5-free` puis `big-pickle` (gratuits, endpoint chat/completions).
  Ecarte d'office : les modeles `*-free` sur endpoint `/responses` (Muse Spark),
  incompatibles avec notre client.
- Constate le 2026-09-03 : quota gratuit Zen epuise (`FreeUsageLimitError` sur mimo,
  big-pickle ; `ling-3.0-flash-fin-free` en 503), meme apres 3 min d'attente. Probablement
  partage avec l'usage de la session en cours. Le produit degrade en gabarit (comportement
  prevu, teste) en attendant le reset. Re-mesure 95 % a faire quota dispo (script pret :
  `CHRONICLER_PROVIDER=zen pnpm --filter @osrune/cli start -- sim --days 15 --seed 7`).
- Vie privee : les gratuits Zen peuvent reutiliser les prompts (dont les ajouts joueur)
  pour l'entrainement. Les chroniques restent de la fiction de village + filtre d'insultes ;
  risque juge acceptable, a re-evaluer si donnees sensibles un jour.

Consequence : changer de fournisseur ou de modele = une ligne d'env, sans redeploiement.
