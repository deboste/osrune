# ADR-008 : fournisseurs chaines Zen + OpenRouter (client bi-endpoint)

Date : 2026-09-03 (completee le soir). Statut : accepte, valide en mesure.

Contexte : la spec 3.2 impose OpenRouter. Le proprietaire veut aussi OpenCode Zen
(gratuit). Zen expose 3 familles : `/responses` (GPT/Grok/Muse Spark), `/messages`
(Anthropic, hors perimetre), `/chat/completions` (DeepSeek/MiniMax/GLM/Kimi/gratuits).

Decision :
- `transport.ts` : `/chat/completions` + `/responses` (raisonnement `effort: low`,
  budget sortie x3, pas de temperature, `store: false`), endpoint devine par prefixe,
  forcable par `CHRONICLER_API`, bascule auto sur l'autre en 404/400.
- `provider.ts` : chaque slot (primaire, fallback) a SON fournisseur et SON modele
  (`CHRONICLER_PROVIDER` / `CHRONICLER_FALLBACK_PROVIDER`). Le client ne refuse plus
  aucun modele : il s'adapte.
- Config proprietaire : primaire Zen `muse-spark-1.3-contributor-free`, fallback
  OpenRouter `minimax/minimax-m3:free` (deux quotas gratuits independants).

Mesures 2026-09-03 :
- Zen chat gratuits (mimo, big-pickle) : quota epuise, non testables ce jour.
- Muse Spark seul (10 j) : 6/10 modele (1 premier essai, 5 repares), 4 gabarits, 9-28 s.
  Francais bon. Les raisonneurs gaspillent ~500 tokens de pensee par appel.
- Chaine Spark -> Minimax OR (10 j) : **10/10 modele, 8 premiers essais, 0 gabarit**,
  1-10 s. Les deux quotas s'equilibrent seuls.
- Zen payant (`muse-spark-1.2`) : 401, pas de moyen de paiement sur le workspace.

Consequence : le critere 95 % ne tient toujours pas strictement sur un seul modele
gratuit, mais la chaine rend le gabarit exceptionnel (0/10 mesure). Changer de modele
ou de fournisseur = une ligne d'env.
Vie privee : les gratuits (Zen comme OpenRouter) peuvent reutiliser les prompts, dont
les ajouts joueur, pour l'entrainement. Contenu = fiction de village + filtre : risque
juge acceptable, a re-evaluer si donnees sensibles un jour.
