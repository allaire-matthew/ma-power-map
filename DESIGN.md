# Dashboard design rules — ma-power-map revamp (2026-07-03)

Step 1–3 of the design homework Matthew assigned before the rebuild. Sources were
re-verified by live fetch on 2026-07-03: Refactoring UI (authors' article +
book-section summaries), Practical Typography (practicaltypography.com), Material 3
(m3.material.io, post-Expressive), Apple HIG (developer.apple.com/design, post-Liquid
Glass), NN/g (nngroup.com), WCAG 2.1, Datawrapper Academy, Axis Maps, Cleveland–McGill,
Shneiderman '96, Few, Tufte. Rule numbers below are cited from code comments where a
choice isn't self-evident.

## Step 2 — Concrete, checkable rules for THIS dashboard

### A. Visual hierarchy
- **A1.** The eye lands first on the map (or the chapters funnel in table view), second
  on the KPI numbers, last on chrome. Achieve this by muting chrome, not enlarging
  content: chrome text uses secondary/muted ink; no colored buttons except one primary
  per view. (RUI "emphasize by de-emphasizing"; NN/g top-left priority; Few's glance layer.)
- **A2.** Hierarchy inside any card uses **weight and ink color at ~one size**, not size
  jumps: value = 600 weight primary ink; label = 400 secondary; meta = 400 muted.
  Exactly 3 text inks, 2 weights (400/600). Nothing under weight 400. (RUI tip 1; HIG "avoid light weights".)
- **A3.** No "Label:" prefixes in detail panels — format carries meaning
  ("Gabe Swanger · lead, confirmed" not "Lead name: Gabe Swanger"). Labels, where
  needed, are smaller + muted and never repeat the column header. (RUI "labels are a last resort".)

### B. Density vs whitespace
- **B1.** Spacing comes off a non-linear scale only: 4 / 8 / 12 / 16 / 24 / 32 / 48.
  Space between groups > space within groups, always. (RUI spacing system + proximity.)
- **B2.** Separate regions by background shift and whitespace first, hairline second,
  never boxed borders around every widget. Table: one hairline under the header, faint
  row rules, no frame, no vertical rules, no zebra. (PT rules-and-borders; ALA tables; Tufte data-ink.)
- **B3.** Density is organized, not amputated: the glance layer (KPIs + map/funnel) fits
  one screen; the work layer (full table, news) may scroll; rarely-used controls sit
  behind one click (overflow/Guide), frequent ones stay visible. (Few one-screen; NN/g
  complex-apps guideline 6; progressive disclosure.)

### C. Chart / encoding selection
- **C1.** Headline numbers are stat tiles, never one-bar charts or gauges. Counts by
  stage = horizontal labeled bars on a common baseline (doubles as a filter), never a
  trapezoid funnel, never a pie. (dataviz skill choosing-a-form; Cleveland–McGill length ≫ area; NN/g anti-gauge.)
- **C2.** The map is categorical/ordinal only — stage and tier classes — never raw
  counts as fills (population lives in the town detail, not the choropleth). (Axis Maps.)
- **C3.** Bar axes start at 0; one axis per plot; no dual axes, no 3D, no rainbow.
  (Datawrapper; dataviz non-negotiables.)
- **C4.** Progress-through-stages per chapter renders as a 6-step segmented track with
  the current stage labeled — position on an ordered scale, not a percentage.

### D. Color
- **D1.** Color encodes meaning or it stays neutral. Semantic assignments are global and
  never reused decoratively: stage = blue ramp→gold (5=Network Hub), policy tier =
  single-hue green ordinal ramp (darker = stronger policy), status = reserved status
  palette (On Track/Stuck/At Risk/Wound Down), parent presence = violet, news/info =
  neutral. Same hex everywhere a meaning appears (map, chips, funnel, legend). (NN/g
  consistency; dataviz status rules; RUI semantic accents.)
- **D2.** Every colored encoding ships with text or an icon — a bare colored dot is a
  bug. Tier chips read "Tier 3"; status chips read "● On Track". (WCAG 1.4.1; NN/g icons.)
- **D3.** Palettes are validated, not eyeballed: run the dataviz validator on the stage
  ramp (--ordinal), tier ramp (--ordinal), and status set before shipping. Red→green
  traffic-light pairs are out (deuteranopia); ordinal ramps are one hue. (dataviz
  skill; Okabe-Ito/Crameri guidance.)
- **D4.** Text never wears a data color; ink tokens only. Inside a colored fill, label
  color is picked by fill luminance. Greys never sit on colored fills — tint toward the
  fill hue instead. (dataviz marks; RUI tip 2.)
- **D5.** Ink is near-black, not #000; page plane off-white; cards white; dark text
  ≥4.5:1, large text and UI boundaries ≥3:1. (PT color; M3/HIG contrast tables.)

### E. Typography & numbers
- **E1.** System sans everywhere including the hero numbers. Sizes: 12 (min, meta) /
  13 (table body floor) / 14 (body) / 16 (panel body) / 20 (section) / 28–32 (stat
  values, proportional figures). Nothing below 11px. (PT 15–25px body, dense-UI floor;
  M3 label-small floor; dataviz figures.)
- **E2.** `font-variant-numeric: tabular-nums` on every table/aligned numeric column and
  axis; proportional on big standalone values. (PT alternate-figures; M3 typography; dataviz.)
- **E3.** Numbers: thousands separators; one precision per metric (populations whole,
  "days in stage" whole, dates as "May 21" / "12 days ago"); right-align numeric
  columns, left-align text and dates; header alignment matches its column. (ALA tables.)
- **E4.** Line-height ~1.2 on headings/tiles, ~1.45 on running text; notes columns cap
  at ~70ch. (PT line-spacing/line-length.)

### F. Layout
- **F1.** Two-pane list-detail at ≥840px: content (map or table) + right detail panel
  that opens in place — never a page navigation, never a modal for record detail. Below
  840px: single pane, detail slides over. Breakpoints at 600/840/1200. (M3 canonical
  layouts + breakpoints; NN/g side-panel preference.)
- **F2.** Top-of-screen order: identity + view tabs → KPI strip → content. Most
  diagnostic table columns leftmost: Chapter, Stage, Status, Lead. First column is the
  human-readable name. (NN/g F-pattern, data-tables.)
- **F3.** Map chrome floats above the canvas (legend, lens switcher, zoom cluster) on
  translucent panels and never covers the same corner as the detail panel; content
  itself never gets glass treatment. (HIG functional layer; M3 surface-container roles.)
- **F4.** Sticky table header; selected row persistently highlighted and synced with
  the map selection — same click, same result, both directions. (HIG lists-and-tables;
  NN/g consistency.)

### G. Interaction
- **G1.** Shneiderman order: overview first (statewide map/KPIs), zoom & filter (lens
  switcher, stage/status/tier filter chips, search), details on demand (town/chapter
  panel). Every filter shows an active chip with an ✕; a filtered-empty table says
  "No matches — clear filters" with the button. (Shneiderman; NN/g filter visibility + empty states.)
- **G2.** All five states on every control (enabled/hover/focus/press/disabled):
  hover = 8% wash, press = 12%, focus = visible `:focus-visible` ring (rows: full-row
  highlight), disabled = reduced-opacity, never hidden nav. (M3 state layers; HIG press state.)
- **G3.** Hover/tooltips enhance, never gate: everything a tooltip shows is also in the
  detail panel or table. Hit targets ≥44×44 CSS px (map towns are their polygons; small
  badges get padded hit areas ≥24px). (dataviz interaction; M3/HIG targets.)
- **G4.** Esc closes panels; Esc/✕ clears search; no destructive actions exist in the
  UI (read-only synthesis — edits happen in the Sheet, linked in place). (NN/g user control.)
- **G5.** Freshness is visible: "Data updated <date>" chip from each feed's
  `_lastUpdated`, per-row "last report ↗ 12d ago"; stale (>30d) reads as an At-Risk
  input per the sheet's own rules. Loading = skeleton on first paint only; refetch holds
  the old frame. (NN/g visibility of system status; dataviz refetch rule.)
- **G6.** Motion only communicates: panel slide ≈ 250–350ms spatial ease, hover fades
  ≈ 150–200ms, nothing animates on sort/filter, `prefers-reduced-motion` swaps motion
  for fades. (M3 standard scheme; HIG motion.)

### H. Accessibility
- **H1.** Contrast per D5 measured against the actual surface; map fills ≥3:1 against
  neighbors or separated by boundary strokes; legend always visible (map view) —
  meaning is never memory-dependent. (WCAG; NN/g recognition over recall.)
- **H2.** Full keyboard path: tabs → search (combobox pattern kept) → filters → table
  rows (arrow keys) → panel; focus never moves without user action. (M3/HIG focus.)
- **H3.** Every chart/map has a text twin: the table IS the twin for the map; the
  funnel bars are labeled with counts; screen-reader labels on chips
  ("Status: On Track"). (dataviz table-view rule.)
- **H4.** rem-based type; layout survives 200% text zoom (panes stack, no clipped
  labels). (HIG dynamic type.)

## Step 3 — Design decisions (stated before build)

**Layout structure.** One-page app, three top tabs — **Map · Chapters · News** — over a
persistent 4-tile KPI strip. Map view: full-bleed pannable/zoomable SVG map (custom
pointer controller replacing tldraw), floating lens switcher (Chapters / Phone policy /
Parent organizing / Districts) instead of 10 checkboxes, legend bottom-left, click →
right detail panel (list-detail). Chapters view: stage funnel bars (click-to-filter) +
spreadsheet table of every chapter & prospect town — logo/affiliation chips, lead,
6-step stage track, status, days-in-stage, supporters, last activity, next action —
same detail panel. News view: self-updating MA news (statewide + per-chapter-town via
Google News RSS + verified local feeds), grouped by town, freshness-stamped. A "Guide"
popover carries the Start Here tab's six-stages/four-statuses/tier explanations so the
uninitiated never need the spreadsheet to decode anything.

**Type & color.** System sans; 3 ink tokens, weights 400/600 only; tabular numerals in
columns; 13–16px working sizes. Off-white page, white cards, near-black ink; meaning
lives in four validated encodings: stage blue-ramp→gold, tier single-hue green ordinal
ramp (replacing the red→green traffic light — CVD-safe; every tier still labeled),
reserved status palette with icon+text, violet parent-presence. Everything else neutral.

**Top 3 principles.** (1) Overview → zoom/filter → details-on-demand as the app's
skeleton; (2) recognition over recall — every encoding labeled in place, legend + Guide
one glance/click away, humane to the uninitiated; (3) hierarchy by weight/ink and
whitespace, not size/boxes — text-light, chrome-mute, data-loud.

**Tradeoffs.** Dropping tldraw loses freehand whiteboard annotation (dormant: Firebase
was never configured; localStorage doodles don't survive the migration) in exchange for
reliable, focus-bug-free pan/zoom. Staying on GitHub Pages keeps zero-ops but means
news/data refresh daily via Actions, not live. Replacing the traffic-light tier scale
trades instant red=bad recognition for colorblind safety — mitigated by tier numbers on
chips and the legend. Chapter-pipeline rows still refresh manually until the Sheet is
link-shared (401 today).
