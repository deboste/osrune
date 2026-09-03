# ADR-004 : modele chroniqueur par defaut (sept. 2026)

Date : 2026-09-03. Statut : accepte, a revalider chaque trimestre.

Contexte : la spec demande de verifier prix/dispo au moment du choix, pas de se fier au document.

Releve du jour (OpenRouter, USD/M tokens) : les prix 2026 sont bien plus bas que l'annexe B. DeepSeek V3 tourne autour de 0,05-0,07 in / 0,10-0,28 out selon routeur ; Qwen3-32B autour de 0,06-0,10 in ; les flagships (Kimi K3, Qwen Max, GLM-5) sont 10 a 50x plus chers et injustifies pour 400 tokens de conte calibre.

Decision : `CHRONICLER_MODEL=deepseek/deepseek-chat-v3-0324`, `CHRONICLER_MODEL_FALLBACK=qwen/qwen3-32b`, `response_format json_object` impose, `max_tokens 600`. Table de prix locale dans `.env` (`PRICE_IN_PER_M=0.07`, `PRICE_OUT_PER_M=0.28`) : estimation ~0,03 ct/jour, sous la cible 0,5 ct.

Consequence : le critere "95% JSON valide au 1er essai sur 50 jours" se mesure avec cles reelles en Phase 0 (script `sim` loge source/tokens). Si DeepSeek decroche en francais, basculer sur Qwen3-32B en une ligne.
