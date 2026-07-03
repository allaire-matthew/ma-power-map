# MA Power Map

Commonwealth IRL's internal tracking dashboard for Massachusetts — the
centralized, self-updating synthesis of the chapter pipeline, parent
organizing, district phone policies, legislators, school-committee meetings,
and local news. Live at <https://allaire-matthew.github.io/ma-power-map/>.

Three views:

- **Map** — pannable/zoomable SVG map of all 351 towns with three lenses
  (Chapters / Phone policy / Organizing) plus boundary overlays
  (counties, school districts, US House, MA Senate, MA House).
- **Chapters** — the spreadsheet view: every chapter and prospect town with
  affiliation logos, leads, 6-stage progress, status, days-in-stage, engaged
  supporters, and advisory health flags computed from the Evaluation
  Scorecard's rules of thumb.
- **News** — MA news relevant to tracked towns (Google News RSS per town +
  CommonWealth Beacon / WBUR / Itemlive), refreshed daily.

The **Guide** button explains the six stages, four statuses, and the tier
system — the humane layer for anyone new to the tool. Design rules and their
sources live in `DESIGN.md`.

## Data & self-updating

`public/data/*.json` is refreshed daily by `.github/workflows/refresh.yml`
(7:17 UTC): legislators, town orgs, chapter pipeline, school-committee
meetings, news, and handbook-extracted phone policies. Pushing to `main`
triggers `deploy.yml` → GitHub Pages.

Known gap: `refresh_chapter_pipeline.py` needs the CIRL Chapter Pipeline
Tracker sheet shared "anyone with link (view)"; until then chapter rows are
regenerated manually via the Sheets MCP.

Heuristics (unchanged, single source `src/colors.ts` + `src/model.ts`):

- **Phone-policy tiers 1–4** — Childhood Index / DFSPP spec (see
  `phone-policies.json` `_notes`).
- **Chapter stages 0–5** and **statuses** — the Pipeline Tracker's Start
  Here tab; advisory flags per its Evaluation Scorecard rules.

## Local development

```bash
npm install
npm run dev
```

Open the printed URL (path: `/ma-power-map/`). `npm run build:geo`
regenerates the GeoJSON from Census TIGER (see `scripts/build-geo.sh`).
