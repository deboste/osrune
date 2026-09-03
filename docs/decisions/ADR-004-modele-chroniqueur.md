# ADR-004 (addendum 2026-09-03) : gratuit reel, Minimax d'abord

Mesure sur 50 jours simules, cle OpenRouter du proprietaire :
- `z-ai/glm-5.2:free` : 429 systematique cote fournisseur pendant tout le test (0 appel abouti).
  Inutilisable en primaire aujourd'hui. Garde en fallback (gratuit, peut revenir).
- `minimax/minimax-m3:free` : 41/50 jours servis, francais de bonne qualite, ~1,4 s mediane,
  1 240 in / 410 out (sous les plafonds 2 500/500), cout 0, cache de prefixe actif.
  Premier essai valide : 29/41 (~71 %). Second appel corrige 12/41. 9/50 en gabarit (429 en rafale).
- `writePeriod` et `createFigures` : meme comportement (gabarit en cas de 429).

Decision : primaire `minimax/minimax-m3:free`, fallback `z-ai/glm-5.2:free`, cout facture 0.
Le critere spec "95 % JSON valide au premier essai" n'est PAS tenu en gratuit (71 % mesure).
Le produit reste sain : 82 % de chroniques modele, 18 % de gabarit (teste, correct).
Option si on veut 95 % : `minimax/minimax-m3` payant (~0,30 $/M in, ~0,05 ct/jour, 300x sous
le plafond gratuit) puis re-mesure. A trancher avec le proprietaire (depenser < 1 ct de test).
