# MA Power Map

Sandbox-style digital whiteboard for Massachusetts power mapping. tldraw canvas
on top of an SVG basemap with toggleable layers (counties, towns w/ population,
US House, MA House, MA Senate). Built for async-shared editing — anyone with
the URL can drop pins, draw, and annotate.

## Local development

```bash
npm install
npm run dev
```

Open the printed URL (path: `/ma-power-map/`).

## Geo data

The five GeoJSON files in `public/geo/` are committed. To regenerate them:

```bash
npm run build:geo
```

Downloads Census TIGER 2024 + 2020 DHC population by MA county subdivision,
simplifies with `mapshaper`, writes to `public/geo/`.

## Shared editing

By default the app persists to `localStorage` (single-user). To turn on
async-shared editing across browsers:

1. Create a Firebase project at <https://console.firebase.google.com>.
2. Build → **Realtime Database** → create (any region; test rules are fine
   for a sandbox).
3. Build → **Authentication** → enable **Anonymous** provider.
4. Project settings → Your apps → Web app → register → copy the config object.
5. Paste it into `src/firebaseConfig.ts`, replacing `null`.
6. Commit and push — GitHub Pages redeploys with shared editing live.

Suggested Realtime DB rules (lock writes to authenticated clients on the one
board path):

```json
{
  "rules": {
    "boards": {
      "ma-power-map": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages.

First-time setup on the repo:
- Settings → Pages → Source: **GitHub Actions**
