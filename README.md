# Water Efficiency in African Data Centers

### DataViz project – Lyon 1 University, Master IA (2025–2026)

[Project site (GitHub Pages)](https://deankoontzg.github.io/DataViz_EVGA/)

![teaser](site.png)

---

## Description
This data visualization explores how **energy consumption**, **climate conditions**, and **water efficiency (WUE)** interact in **data centers across Africa**.  
It aims to reveal how different **climate regions** and **energy mixes** (renewables vs. fossil fuels) impact the **water footprint** of data centers and AI infrastructure.

Through interactive D3.js visualizations, the project highlights:
- Which countries consume the most electricity,
- How their water usage efficiency compares,
- The influence of temperature, humidity, and leakages on performance.

---

## Goals
- Understand the environmental impact of AI computing and data centers in Africa.  
- Promote awareness about sustainable water management in the energy and tech sectors.  
- Provide an educational and policy-oriented visualization accessible to the public.

---

## Tech stack
- **Frontend:** HTML, CSS, JavaScript  
- **Visualization:** D3.js v7  
- **Hosting:** GitHub Pages (.io)  

---

## Visualizations
1. **Map of Africa:** Energy consumption intensity (Total Energy – TWh), with tooltip showing the national energy mix.  
2. **Scatterplot:** Relationship between renewables share and indirect water usage efficiency (WUE Indirect).  
3. **Boxplot:** Cooling water efficiency (WUE Direct) by climate region.  
4. **Bar chart:** Water losses due to leakages per country.

---

## Installation & Setup
1. Clone the project

```bash
git clone https://github.com/DeankoontzG/DataViz_EVGA.git
cd DataViz_EVGA
```

2. Create the Conda environment

Make sure you have Conda installed.

```bash
conda env create -f environment.yml
```

Then activate it:

```bash
conda activate WEA
```

3. Run a local development server

The visualization uses HTML + D3.js, so a static server is required.
If Node.js is installed (included in the environment):

```bash
npx http-server .
```

Then open:

```bash
http://localhost:8080
```

---
## Structure of the Projet

```
DataViz_EVGA/
│
├── index.html # Interface principale
├── main.py # Serveur HTTP + API REST
├── README.md # Documentation
├── avancement.txt # Cahier de bord
│
├── data/ # Cache JSON (gitignored)
│ └── \*.json
│
├── scraper/
│ ├── whoscored_scraper.py # Module de scraping WhoScored
│ ├── image_scraper.py # Récupération photos joueurs
│ ├── requirements.txt # Dépendances Python
│ └── **init**.py
│
└── src/
├── css/
│ └── style.css # Styles modernes (Glassmorphism)
│
└── js/
├── main.js # Orchestrateur principal
├── dataManager.js # Gestion des données + traduction FR
├── pitch.js # Moteur géométrique SVG
├── dashboard.js # Vue d'ensemble multi-métriques
├── passmap.js # Réseau de passes interactif
├── shotmap.js # Carte des tirs + xG
├── heatmap.js # Densité de présence
├── radarChart.js # Profil radar performance
├── progressivePasses.js # Analyse passes progressives
├── timeline.js # Timeline temporelle
├── zoneAnalysis.js # Statistiques par zone
├── actions.js # Gestion des événements
└── defensiveActions.js # Module défensif (en développement)

```

---

## 👥 Team
- Edgar Demeude
- Ghuilhem Dupuy
- Vu Anh Duy
- Vincent Joulain

---

## 📚 Credits & Sources
- Dataset: [Water Efficiency Dataset for African Data Centers](https://huggingface.co/datasets/masterlion/WaterEfficientDatasetForAfricanCountries)
- Visualization framework: [D3.js v7](https://d3js.org/)

---

## 🏫 Links
- [DataViz Course – Université Lyon 1](https://lyondataviz.github.io/teaching/lyon1-m2/2025/)
- [Project site (GitHub Pages)](https://deankoontzg.github.io/DataViz_EVGA/)

---

© 2025-2026 – Lyon 1 University – Data Visualization Project
