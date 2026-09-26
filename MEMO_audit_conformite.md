# Mémo — Audit de conformité AtelierManager

**Date** : 2026-09-26
**Objectif** : Comparer le produit livré à la présentation métier jointe, corriger uniquement les défauts non ambigus et consigner les décisions nécessaires.

## Périmètre
- Inclus : examen du cahier des charges, de l’interface, des routeurs, du schéma et des tests; corrections locales ciblées; vérification typecheck/tests/build.
- Hors périmètre : supprimer des données métier, configurer ou tester des prestataires de paiement.

## Contexte technique
- Stack : React/Vite, tRPC/Express, Drizzle/PostgreSQL (Neon), Netlify Functions.
- Référence : `AtelierManager-Presentation.docx`; code au commit de départ `e8083f1`.
- Conventions : garder les règles métier côté serveur, tests Vitest, migrations Drizzle versionnées.

## Décisions prises
- Après l’accord explicite du propriétaire, verrouiller les cinq comptes démo en production en annulant leur hash et en incrémentant leur version de session; conserver tous les comptes et données.
- Ne jamais publier les mots de passe des comptes de démonstration; ne pas créer de mot de passe par défaut en production.
- Tout paiement de démonstration doit rester distinct d’un paiement confirmé par Moneroo.

## Points de sécurité identifiés
- Aucun secret ne doit être écrit dans le dépôt. La migration de sécurité conserve les enregistrements utilisateur et invalide les anciennes sessions ciblées.
- Les comptes de démo sont en lecture seule et leurs hashes de mot de passe ont été supprimés en production.

## Paiement
- Prestataire visé : Moneroo.
- État de départ : README du projet indique une simulation lorsque les clés Moneroo manquent; les clés de production ne sont pas demandées ni modifiées dans cette mission.
- Ne pas activer l’encaissement réel ni déclarer les paiements conformes sans validation Moneroo en environnement sandbox; le déploiement sécurité ne vaut pas validation du paiement.

## Plan d’exécution
- [x] Lire les 17 sections du cahier des charges.
- [x] Examiner le code et les tests existants.
- [x] Verrouiller les cinq comptes en production après l’accord explicite de l’utilisateur.
- [x] Supprimer les credentials visibles du login et du README; enlever tout mot de passe par défaut du seed.
- [x] Valider typecheck, 85 tests (1 ignoré) et build; pousser `3b39e3c` sur `main` et déployer sur Netlify production (deployment `6ab7b4172cf8dc95b2ae9b5e`, état ready).
- [x] Rédiger le rapport de conformité, distinguer les écarts certains, les limites de test et les décisions métier ouvertes.
