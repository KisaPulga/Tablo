# Cahier des charges – Application de service événementiel

*Nom de travail : « Passe » (à remplacer) · Version 1.0 · MVP pour la soirée de vendredi*

## 1. Contexte et objectif

Une soirée est organisée vendredi soir. Plusieurs personnes feront le service (prise de commande aux tables, apport des boissons/plats). L'application web remplace le carnet papier : chaque serveur note les commandes par table sous forme de **tickets**, un **écran au bar (tablette)** reçoit les tickets en temps réel pour préparer les commandes, et un **décompte final** indique qui a vendu quoi.

**Objectifs prioritaires :**

- Prendre une commande à une table en moins de 30 secondes, depuis un téléphone.
- Que le bar voie chaque commande immédiatement, sans que le serveur ait à revenir.
- Avoir un décompte fiable à la fin de la soirée (par serveur et par produit).

**Contrainte de délai :** développement en « vibe coding » (Claude, Copilot), temps disponible : lundi soir (un peu), mardi soir (beaucoup), jeudi après-midi (beaucoup). Tout ce qui n'est pas dans le MVP est repoussé.

## 2. Utilisateurs et rôles

| Rôle | Qui | Droits |
| --- | --- | --- |
| **Admin** | L'organisateur (toi) | Tout : inviter des utilisateurs, gérer tables et menu, voir/modifier/annuler tous les tickets, voir le décompte |
| **Serveur** | Les personnes invitées | Créer des tickets, modifier ses propres tickets tant qu'ils ne sont pas servis, voir tous les tickets en lecture seule |
| **Bar** | Compte dédié à la tablette | Voir tous les tickets entrants, les passer en « en préparation » puis « prêt » |

Pas de système de rôles plus complexe que ces trois-là.

## 3. Périmètre

### 3.1 Dans le MVP (indispensable)

1. Authentification avec invitation
2. Gestion des tables
3. Gestion du menu (produits et prix)
4. Création et suivi des tickets par table
5. Vue partagée des tickets (les miens + ceux des autres)
6. **Écran bar sur tablette avec réception à distance des tickets**
7. Décompte final et statistiques avancées (par serveur, par produit, par heure, par table, temps de service)

### 3.2 Hors MVP (seulement si du temps reste)

- Plan de salle visuel en glisser-déposer (le MVP utilise une grille/liste de tables)
- Mode hors-ligne complet
- Historique multi-événements
- Application native (iOS/Android)

## 4. Spécifications fonctionnelles

### 4.1 Authentification et invitations

- Connexion par email (lien magique ou email + mot de passe, au choix le plus simple avec Supabase Auth).
- Les inscriptions libres sont **désactivées** : seul l'admin peut inviter quelqu'un (invitation par email depuis le tableau de bord Supabase ou depuis une page admin).
- Chaque utilisateur a un **nom d'affichage** (ex. « Léa ») visible sur ses tickets.
- L'admin attribue le rôle (serveur ou bar) à chaque utilisateur.
- La session reste ouverte sur le téléphone (pas besoin de se reconnecter à chaque fois).

### 4.2 Gestion des tables

- L'admin peut **ajouter, renommer, supprimer et réordonner** des tables (ex. « Table 1 », « Terrasse 3 », « Bar »).
- Affichage en **grille de grosses tuiles** adaptée au tactile.
- Chaque tuile affiche : le nom de la table, le nombre de tickets en cours (pastille) et le total cumulé de la table.
- Modification possible directement depuis le téléphone, en pleine soirée.
- *(Option si le temps le permet)* : plan de salle avec positionnement libre des tables.

### 4.3 Gestion du menu

- L'admin peut **créer, modifier, désactiver et supprimer** des produits depuis l'application.
- Champs d'un produit : nom, prix, catégorie (ex. Bières, Softs, Cocktails, Snacks), disponible oui/non.
- Le bouton « disponible » permet de masquer instantanément un produit en rupture, chez tous les serveurs.
- Les produits sont affichés par catégorie, avec de gros boutons.

### 4.4 Tickets par table

Un **ticket** = une commande d'une table, prise par un serveur.

**Parcours du serveur :**

1. Il ouvre l'application et choisit une table.
2. Il clique sur « Nouveau ticket ».
3. Il ajoute des produits (touche = +1, bouton – pour retirer), avec possibilité d'ajouter une **note libre** par ligne ou par ticket (ex. « sans glaçons »).
4. Il vérifie le récapitulatif et le total.
5. Il clique sur **« Envoyer au bar »** : le ticket passe au statut *Envoyé* et apparaît immédiatement sur la tablette du bar.
6. Quand le bar a préparé la commande, le serveur est prévenu (notification dans l'app), va la chercher et la dépose à la table.
7. Il marque le ticket comme **« Servi »**.
8. Pour une nouvelle commande de la même table, il crée un **nouveau ticket** (une table peut avoir plusieurs tickets au fil de la soirée).

**Statuts d'un ticket :**

| Statut | Signification | Qui le change |
| --- | --- | --- |
| Brouillon | Commande en cours de saisie, pas encore visible au bar | Serveur |
| Envoyé | Transmis au bar, en attente | Serveur |
| En préparation | Pris en charge par le bar | Bar |
| Prêt | À récupérer au bar | Bar |
| Servi | Livré à la table | Serveur |
| Annulé | Annulé (exclu du décompte) | Serveur (le sien) ou admin |

**Règles :**

- Un ticket **Brouillon** est modifiable librement et invisible du bar.
- Un ticket **Envoyé** peut encore être modifié par son serveur tant que le bar ne l'a pas pris en préparation ; toute modification est signalée visuellement au bar (ex. badge « modifié »).
- Après « En préparation », seule une annulation ou un ticket complémentaire est possible.
- Chaque ticket enregistre : table, serveur, lignes (produit, quantité, prix **au moment de la commande**), note, heure de création, heure de chaque changement de statut.
- Le prix est copié dans la ligne de ticket pour que le décompte reste juste même si le prix du menu change ensuite.
- Un ticket n'est **jamais supprimé définitivement** : il est annulé, ce qui garde la trace.

**Plusieurs tickets par table, addition cumulée :** une table peut avoir autant de tickets que nécessaire au fil de la soirée, créés par un ou plusieurs serveurs. Tous les tickets d'une même table s'additionnent : la fiche de la table affiche le total cumulé (tickets annulés exclus), avec le détail ticket par ticket. Chaque ticket reste rattaché à son serveur, ce qui permet de voir ensuite le détail par personne.

### 4.5 Vue partagée des tickets

- Chaque serveur voit **ses propres tickets** (onglet « Mes tickets ») et **ceux des autres** (onglet « Tous les tickets »).
- Les tickets des autres sont en **lecture seule** pour un serveur.
- Filtres : par table, par statut, par serveur.
- Mise à jour **en temps réel** (Supabase Realtime) : pas besoin de rafraîchir la page.
- Chaque ticket affiche : table, serveur, contenu, statut, heure et ancienneté (ex. « il y a 4 min »).
- L'admin voit et peut modifier tout.

### 4.6 Écran bar (tablette) — exigence clé

Une **tablette posée au bar** affiche en continu les commandes envoyées par les serveurs, sans intervention des serveurs.

**Affichage :**

- Page dédiée (ex. `/bar`), conçue pour la tablette en **mode paysage, plein écran**.
- Affichage en **colonnes ou file d'attente** : *Nouveau* → *En préparation* → *Prêt*.
- Chaque carte-ticket affiche en **gros caractères** : numéro de ticket, table, nom du serveur, liste des produits avec quantités, notes, et l'**ancienneté** du ticket.
- Les tickets les plus anciens apparaissent en premier ; un ticket en attente depuis trop longtemps (ex. > 5 min) change de couleur.
- Les tickets modifiés après envoi sont signalés clairement.

**Temps réel et alerte :**

- Un nouveau ticket apparaît **instantanément** (Supabase Realtime), sans rafraîchir.
- Une **alerte sonore** et un flash visuel signalent un nouveau ticket.
- Un bouton « Activer le son » au démarrage de la page est nécessaire (les navigateurs bloquent le son tant qu'on n'a pas touché l'écran).
- L'écran **reste allumé** (Screen Wake Lock) pour ne pas se mettre en veille.

**Actions au bar :**

- Un gros bouton par ticket : « Prendre en charge » puis « Prêt ».
- Quand le bar passe un ticket à **Prêt**, le serveur concerné reçoit une notification dans l'app (bandeau + vibration/son si possible) pour venir chercher la commande.

**Robustesse (important vu le wifi d'événement) :**

- Indicateur de connexion bien visible (vert / rouge).
- Reconnexion automatique du temps réel ; en secours, **rafraîchissement périodique** (toutes les 5 à 10 secondes) si la connexion temps réel est perdue.
- Compte « Bar » dédié, session longue, sans besoin de se reconnecter en cours de soirée.

*(Option si le temps le permet : séparer « Bar » et « Cuisine » via une destination par produit ; dans le MVP, tous les tickets vont au bar.)*

### 4.7 Décompte final

- Page « Décompte » réservée à l'admin (visible aussi en lecture seule pour les serveurs si souhaité).
- Ne compte que les tickets non annulés et non brouillons.
- **Par serveur** : nombre de tickets, nombre d'articles, chiffre d'affaires.
- **Par produit** : quantité totale vendue, chiffre d'affaires.
- **Détail croisé** : pour chaque serveur, ce qu'il a vendu produit par produit.
- **Par table** : total cumulé de tous les tickets de la table, avec le détail par ticket et par serveur.
- **Total général** de la soirée.
- Export **CSV** pour archivage ou calcul de répartition.
- Le décompte est calculé directement depuis la base : il est correct même si un serveur ferme l'application ou perd la connexion.

### 4.8 Statistiques avancées (obligatoires)

Calculées à partir des mêmes tickets et des mêmes horodatages que le décompte, dans un onglet « Statistiques » de la page de décompte (admin).

- **Ventes par heure** : quantité et chiffre d'affaires par tranche de 15 minutes ou d'une heure, pour repérer les pics de la soirée (courbe ou histogramme).
- **Top produits** : classement par quantité et par chiffre d'affaires, avec la part de chaque produit et de chaque catégorie.
- **Classement des serveurs** : chiffre d'affaires, nombre de tickets, nombre d'articles, panier moyen.
- **Panier moyen** et nombre moyen d'articles par ticket.
- **Ventes par table** : quelles tables ont le plus consommé.
- **Temps de service** : durée moyenne entre « envoyé » et « en préparation », entre « envoyé » et « prêt », et entre « prêt » et « servi », au global et par serveur ; ticket le plus long de la soirée.
- **Taux d'annulation** : part des tickets annulés, par serveur.
- **Filtres** : par période, par serveur, par catégorie.
- **Export CSV** de ces statistiques.

## 5. Exigences non fonctionnelles

- **Mobile first** : conçu d'abord pour téléphone (usage à une main, boutons d'au moins 44 px), puis tablette pour l'écran bar, ordinateur en dernier.
- **Rapidité** : action de commande (ajout d'un produit) ressentie comme instantanée ; mises à jour temps réel en moins de 2 secondes dans de bonnes conditions réseau.
- **Lisibilité en soirée** : contrastes forts, gros textes ; un **mode sombre** est recommandé pour les ambiances à faible lumière.
- **Fiabilité** : aucune perte de donnée ; une écriture échouée doit être signalée clairement à l'utilisateur et pouvoir être rejouée.
- **Sécurité** : accès réservé aux utilisateurs invités ; règles Supabase (RLS) strictes (voir section 7).
- **Capacité** : de l'ordre de 5 à 15 utilisateurs simultanés, quelques centaines de tickets sur la soirée. Le plan gratuit de Supabase et Vercel suffit.
- **Compatibilité** : derniers Safari (iOS) et Chrome (Android) ; tablette en Chrome ou Safari.
- **Installable** (optionnel) : fonctionner comme application ajoutée à l'écran d'accueil (PWA simple).

## 6. Stack technique

| Élément | Choix |
| --- | --- |
| Front-end | Next.js (App Router) + React + TypeScript |
| Style | Tailwind CSS (composants simples, éventuellement shadcn/ui) |
| Base de données et auth | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| Hébergement | Vercel (déploiement automatique depuis GitHub) |
| Outils de développement | Claude Code / Claude, GitHub Copilot, Git |

## 7. Modèle de données (proposition)

**profiles** : id (= id utilisateur Supabase), display\_name, role (`admin` | `serveur` | `bar`)

**tables** : id, name, sort\_order, is\_active

**categories** : id, name, sort\_order

**products** : id, category\_id, name, price (en centimes), is\_available, sort\_order

**tickets** : id, table\_id, waiter\_id (→ profiles), status (`brouillon` | `envoye` | `en_preparation` | `pret` | `servi` | `annule`), note, created\_at, sent\_at, preparing\_at, ready\_at, served\_at, updated\_at

**ticket\_items** : id, ticket\_id, product\_id, product\_name (copie), unit\_price (copie, en centimes), quantity, note

**Vue ou requête de décompte** : agrégation de `ticket_items` jointe à `tickets` (hors brouillon et annulé), groupée par serveur et par produit.

**Règles de sécurité (RLS) à écrire dès le début :**

- Seuls les utilisateurs connectés et ayant un profil peuvent lire quoi que ce soit.
- Tous les rôles lisent tables, produits et tickets.
- Un serveur ne peut créer que des tickets à son nom et modifier que **ses** tickets tant que leur statut le permet.
- Seul le rôle bar (ou admin) peut passer un ticket en *en préparation* ou *prêt*.
- Seul l'admin modifie tables, produits et rôles.
- Activer Realtime uniquement sur `tickets` et `ticket_items` (et `products` pour la disponibilité).

## 8. Écrans (arborescence)

- `/login` : connexion
- `/` : grille des tables (accueil serveur)
- `/table/[id]` : tickets de la table + bouton « Nouveau ticket »
- `/ticket/[id]` : saisie et détail d'un ticket
- `/tickets` : mes tickets / tous les tickets (avec filtres)
- `/bar` : écran tablette du bar
- `/admin/tables` : gestion des tables
- `/admin/menu` : gestion du menu
- `/admin/users` : utilisateurs et rôles
- `/admin/decompte` : décompte final et export CSV

## 9. Planning et priorités

| Moment | Objectif |
| --- | --- |
| **Lundi soir** | Projet Next.js + Supabase créé, déployé sur Vercel, schéma de base et RLS, authentification et invitations, rôles |
| **Mardi soir** | Tables, menu, création de tickets (brouillon → envoyé), vue des tickets |
| **Mercredi (si possible)** | Écran bar, temps réel, notification « prêt » |
| **Jeudi après-midi** | Décompte, statistiques avancées et export, finitions mobile, mode sombre, test sur vrais appareils |
| **Jeudi soir** | Test grandeur nature avec 2 ou 3 personnes et la vraie tablette, corrections |
| **Vendredi** | Événement, plan B papier prêt |

**Ordre de priorité si le temps manque :**

1. Auth + tables + menu + tickets
2. Écran bar temps réel
3. Décompte
4. Notification « prêt » aux serveurs
5. Mode sombre, export CSV, PWA
6. Plan de salle visuel (probablement à abandonner)

## 10. Tests et critères d'acceptation

L'application est prête quand tous ces points sont validés **sur de vrais appareils** :

- [ ] Un serveur invité peut se connecter sur son téléphone et reste connecté.
- [ ] Une personne non invitée ne peut pas accéder à l'application.
- [ ] L'admin crée, renomme et supprime une table depuis son téléphone.
- [ ] L'admin modifie un produit ou le rend indisponible, et le changement est visible chez les serveurs en moins de 2 secondes.
- [ ] Un serveur crée un ticket pour une table, l'envoie, et il apparaît sur la tablette du bar en moins de 2 secondes avec une alerte sonore.
- [ ] Le bar passe un ticket en « prêt » et le serveur concerné est prévenu.
- [ ] Un serveur voit ses tickets et ceux des autres, mais ne peut modifier que les siens.
- [ ] Plusieurs tickets peuvent être créés pour une même table.
- [ ] Un ticket annulé n'apparaît plus dans le décompte.
- [ ] Le décompte final correspond exactement à la somme des tickets (vérifié sur un jeu de test).
- [ ] La tablette du bar reste allumée plus d'une heure et se reconnecte seule après une coupure wifi.

## 11. Risques et plan B

| Risque | Parade |
| --- | --- |
| Wifi d'événement instable | Données mobiles en secours, indicateur de connexion, rafraîchissement périodique de secours ; tester sur place si possible |
| Tablette qui se met en veille ou se déconnecte | Wake Lock, session longue, réglage de la tablette (veille désactivée, branchée sur secteur) |
| Bug bloquant pendant la soirée | **Plan B papier** : blocs de tickets numérotés imprimés, un exemplaire par table |
| Dérive du périmètre (l'IA ajoute des fonctions) | Cahier des charges collé au début de chaque session, interdiction d'ajouter des fonctions hors liste |
| Règles RLS mal écrites | Les écrire et les tester en premier, relire à la main |
| Plan de salle trop long à développer | Reporté hors MVP |

## 12. Consignes pour le développement avec l'IA

- Coller ce cahier des charges au début de chaque nouvelle conversation (ou le placer dans un fichier `SPEC.md` à la racine du projet).
- Travailler **une fonctionnalité à la fois**, la tester sur téléphone, puis faire un commit Git.
- Demander explicitement à l'IA de **ne rien ajouter** qui ne soit pas dans la liste du MVP.
- Pour un bug persistant : nouvelle conversation, message d'erreur exact + fichier concerné.
- Relire soi-même le code touchant à l'authentification et aux règles de sécurité.
- Déployer sur Vercel dès le premier jour et tester chaque étape sur le site déployé.
