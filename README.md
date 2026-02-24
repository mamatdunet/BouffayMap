# Bouffay Map — Cartographie des logements sous-utilises

Carte interactive du quartier Bouffay (Nantes centre) croisant **4 sources de donnees ouvertes** pour identifier les logements potentiellement vacants, sous-utilises ou retires du marche locatif.

![Stack](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Vite_5-646CFF?logo=vite&logoColor=white)
![Stack](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)

## Apercu

L'application affiche une carte sombre (CartoDB Dark Matter) centree sur le quartier Bouffay et superpose plusieurs couches de donnees :

- **Transactions DVF** (bleu/jaune) — mutations foncieres des 3 dernieres annees
- **Diagnostics DPE** (vert a rouge) — performance energetique des batiments
- **Zones IRIS INSEE** (cyan) — taux de vacance et residences secondaires par micro-quartier
- **Zones de suspicion** (halos violets) — score multicritere croisant les 3 sources

## Score de suspicion multicritere

Chaque micro-zone recoit un score composite de 0 a 100 base sur **7 signaux** :

| Signal | Points max | Source | Description |
|--------|-----------|--------|-------------|
| Stagnation DVF | 25 | DVF | Vente > 2 ans sans revente dans la zone |
| Passoires DPE | 20 | DPE | Ratio de batiments classes F ou G |
| Invisibilite DPE | 10 | DVF x DPE | Transaction DVF sans diagnostic DPE associe |
| Vacance INSEE | 20 | INSEE IRIS | Taux de vacance superieur a la moyenne des IRIS |
| Residences secondaires | 10 | INSEE IRIS | Taux eleve de residences secondaires |
| Bati ancien degrade | 10 | DPE | Batiment pre-1945 avec mauvaise classe DPE |
| Anomalie prix/m2 | 5 | DVF | Prix/m2 anormalement bas vs moyenne locale |

**Score > 30 = probable sous-utilisation du logement.**

## Sources de donnees

| Source | API | Donnees |
|--------|-----|---------|
| **DVF** | [Cerema / DGFiP](https://apidf-preprod.cerema.fr/) | Transactions immobilieres geolocalisees |
| **DPE** | [ADEME](https://data.ademe.fr/) | Diagnostics de performance energetique |
| **INSEE** | Recensement IRIS 2021 | Logements vacants, residences principales/secondaires |
| **Leaflet** | [CartoDB](https://carto.com/) | Fond de carte sombre |

Les APIs DVF et DPE sont appelees directement depuis le navigateur. Si elles ne repondent pas (CORS, reseau), des donnees de demonstration realistes basees sur la geographie reelle du quartier Bouffay sont affichees automatiquement.

Les donnees INSEE IRIS sont embarquees dans l'application (4 zones couvrant le perimetre Bouffay) car l'API INSEE ne supporte pas les appels navigateur directs.

## Perimetre geographique

- **Centre** : 47.2139, -1.5535 (Place du Bouffay)
- **Limites** : sud 47.2105, nord 47.2175, ouest -1.5595, est -1.5465
- **Zones IRIS** : Bouffay, Decre-Cathedrale, Chateau-Maillard, Feydeau-Commerce

## Installation

```bash
# Cloner le repo
git clone https://github.com/mamatdunet/BouffayMap.git
cd BouffayMap

# Installer les dependances
npm install

# Lancer en developpement
npm run dev

# Build de production
npm run build
```

## Stack technique

- **React 18** — composant unique (`bouffay-map.jsx`)
- **Vite 5** — bundler et serveur de developpement
- **Leaflet 1.9** — carte interactive (charge via CDN)
- **CartoDB Dark Matter** — tuiles de fond de carte

Aucune dependance additionnelle — tout le rendu (sidebar, stats, graphiques, legende) est fait en React inline styles.

## Structure du projet

```
BouffayMap/
  bouffay-map.jsx    # Composant principal (carte + sidebar + scoring)
  index.html         # Page HTML racine
  src/
    main.jsx         # Point d'entree React
  package.json
  vite.config.js
```

## Architecture du composant

Le fichier `bouffay-map.jsx` contient :

1. **Constantes** — coordonnees Bouffay, palette de couleurs, donnees IRIS embarquees
2. **Composants UI** — `StatCard`, `LayerToggle`, `LoadingDots`
3. **Composant principal** `BouffayMap` :
   - Chargement dynamique de Leaflet (CSS + JS via CDN)
   - Initialisation de la carte avec limites Bouffay
   - Fetch des donnees DVF et DPE avec fallback
   - Algorithme `computeSuspicionZones()` (grille + 7 signaux)
   - Algorithme `pointInPolygon()` (ray-casting pour rattachement IRIS)
   - Rendu des 4 couches de marqueurs
   - Sidebar avec stats, toggles, distribution DPE, zones IRIS, methodologie

## Donnees manquantes pour aller plus loin

Ces sources enrichiraient significativement l'analyse mais ne sont pas en open data :

- **LOVAC** (fichier detaille des logements vacants) — reserve aux collectivites
- **Fichiers fonciers MAJIC** — reserve aux collectivites
- **Consommation Enedis/GRDF** — agrege IRIS uniquement
- **Registre meubles touristiques** — pas en open data a Nantes
- **Taxe logements vacants (THLV)** — donnees fiscales confidentielles
- **Inside Airbnb** — Nantes non couvert

## Deploiement

Le projet est deploye sur Vercel. Chaque push sur `main` declenche un deploiement automatique.

## Licence

MIT
