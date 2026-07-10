# MA Power Map

Matthew Allaire's personal tracking dashboard for Massachusetts — a
centralized, self-updating synthesis of parent organizing, district phone
policies, legislators, and school-committee meetings. Live at
<https://allaire-matthew.github.io/ma-power-map/>.

Two views:

- **Map** — pannable/zoomable SVG map of all 351 towns with two lenses
  (Phone policy / Organizing) plus boundary overlays (counties, school
  districts, US House, MA Senate, MA House).
- **Local groups** — the spreadsheet view: every town with an identified
  parent-organizing group, with affiliation logos and leads.

The **Guide** button explains the tier system and local-groups data — the
humane layer for anyone new to the tool. Design rules and their sources live
in `DESIGN.md`.

## Data & self-updating

`public/data/*.json` is refreshed daily by `.github/workflows/refresh.yml`
(7:17 UTC): legislators, town orgs, school-committee meetings, and
handbook-extracted phone policies. Pushing to `main` triggers `deploy.yml` →
GitHub Pages.

Heuristics (unchanged, single source `src/colors.ts` + `src/model.ts`):

- **Phone-policy tiers 1–4** — Childhood Index / DFSPP spec (see
  `phone-policies.json` `_notes`).

## Local development

```bash
npm install
npm run dev
```

Open the printed URL (path: `/ma-power-map/`). `npm run build:geo`
regenerates the GeoJSON from Census TIGER (see `scripts/build-geo.sh`).
