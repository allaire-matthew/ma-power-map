# Autonomous Overnight Debug & Feature Session — ma-power-map

**Duration target:** 6 hours of clock time, self-paced via `ScheduleWakeup`.
**Repo:** `~/code/ma-power-map` (allaire-matthew/ma-power-map → GH Pages at https://allaire-matthew.github.io/ma-power-map/).
**Stop condition:** all P0 + P1 items in this file are checked off, OR 6 hours elapse, OR a hard blocker appears that genuinely needs a human (rare; document and pause).

---

## The session contract

You are running this autonomously. **Do not ask Matthew anything.** Don't post status menus, don't request approval, don't propose alternatives. Pick the next P0 item, do it, push, move on. Push after every successful build (per `feedback_always_push_after_build.md`). Use `Bash` for any verification step you can run yourself.

**Cadence.** After each push or major investigation, `ScheduleWakeup` for somewhere in 60–270s if you're still mid-task and want the cache warm, or 1200–1800s if you're between tasks. Do not pick 300s. Do not sleep just to sleep — schedule only when you have concrete next work and know roughly when to resume. Hard cap: schedule no further than ~6 hours total from the session start.

**End-of-session report.** When you stop (whether by completion or timeout), write a final summary to `OVERNIGHT_SESSION_REPORT.md` in the repo root with: what got fixed, what got added, what remains, what surprised you, and any P0 items you couldn't close.

**Memory.** Save durable lessons to `~/.claude/projects/-Users-matthewallaire/memory/` per the auto-memory rules. Don't pollute with one-off task state.

---

## P0 — Bugs to verify and close (do these first)

Each item: **reproduce → fix → verify in the browser if possible → push.**

1. **Phone-free toggle visibility.** Matthew reported "still doesn't have a toggle for phone free status." `LayerToggles.tsx` clearly includes it; the LS_KEY bump in this commit (`f61c996`) should reset stale state. Open the live site via Chrome MCP (`mcp__claude-in-chrome__navigate` to `https://allaire-matthew.github.io/ma-power-map/` after the deploy lands), inspect the header DOM, confirm 5 toggles render with "Phone-free status" first and checked. If it's missing or unchecked, dig deeper — check `localStorage`, console errors, race conditions in `loadLayers()`. Record findings in this file.

2. **Size gradient invisible.** Already partially fixed in `f61c996`. Verify in-browser: with phoneFree OFF + sizeGradient ON, you should see a gray ramp where larger districts are visibly darker than smaller ones. With both ON, larger districts should be visibly more saturated. If still hard to see, increase the dynamic range further or pick a different visual encoding (e.g. fill pattern for size, color for tier).

3. **Cape Cod / island rendering.** With per-town fills (commit `277ab5f`) the puffy ocean halo should be gone. Verify Cape Cod, Martha's Vineyard, Nantucket render tight to coastlines. If any town polygon looks broken (orphan shape, wrong island), trace via the geojson and consider replacing with a TIGER 2023 shapefile.

4. **Town → district lookup correctness.** Matthew reported "Policies are not correctly mapping to district." `getTownToDistrict()` uses `geoContains` on lng/lat centroids. Run a sanity audit: for the seeded districts (Boston, Newton, Brookline, Brockton, Westford, Salem, etc.) confirm that clicking a town inside that district shows the right policy in the popup. If wrong, check whether the town centroid actually falls inside the right district polygon (some towns straddle multiple districts; some districts are non-contiguous like vocational/regional). Build a fix or a fallback strategy (multi-district per town?).

5. **Click-to-popup reliability.** Verify clicking different towns reliably opens the popup at bottom-left with the correct town name + population + district + policy. Try towns at the edges (Boston, Provincetown, Williamstown), small islands (Cuttyhunk, Aquinnah), and the Boston metro core.

6. **Hover priority.** Confirm hover always returns town names and never gets pre-empted by a district or legislative outline.

---

## P1 — Data: fill in more of the 80+ districts

Per `RESEARCH_SPEC_PHONE_POLICIES_V2.md`, the highest-leverage starting input is the **DESE Fund Code 729 "Approaches to Address Student Cellphone Use Pilot Grant"** awardee list (~77 districts). Also valuable: the MA AG toolkit released Jan 2025.

1. **Get the DESE awardee list.** Try:
   - `curl -L https://www.doe.mass.edu/grants/2024/729/ -o /tmp/729.html` and grep for awardee names or links to a recipient list.
   - DESE Grant Allocations & Awards page: https://www.doe.mass.edu/grants/awards.html
   - If the public list isn't published, search Globe / WBUR / Axios / Boston Globe Spotlight for stories that name awardees.
   - Last resort: do without the list and crawl 30+ named districts from local-news search.

2. **Per-district pass.** For each district added beyond the seeded 10:
   - Search district domain first (`site:<district>.org "cell phone"`).
   - Cross-check against local town newspaper.
   - Apply the V2 evidence bar: tier 3 needs ≥2 independent sources, at least one primary.
   - Match `districtId` to the GEOID in `public/geo/ma-school-districts.geojson`. Use `python3 -c "..."` to grep the geojson when in doubt.
   - Append to `public/data/phone-policies.json`. Don't delete existing entries.
   - Commit per batch: `data: refresh phone policies (+N districts)` with the names in the body.

3. **Target:** at least 30 net-new districts entered with confidence ≥medium, sourced at least one primary URL each. Stretch: 60+.

4. **Watch for tier-3 candidates.** Anything described as "Yondr K-12" or "magnetic pouches K-12" is a candidate; prove it with a second source.

---

## P2 — Features (in priority order, only if P0/P1 are done)

1. **Per-school overlay.** Boston has Yondr at ~31 schools out of ~120; Westford has Yondr at middle but not HS. Currently the district-level tier flattens this. Consider: capture per-school data in the JSON, render a small "schools with hardware" indicator inside Boston when zoomed.

2. **Tier-3 callouts.** When phoneFree is on and the user has a tier-3 district visible, show a subtle bookmark/badge so they're easy to spot at a glance.

3. **Statewide mandate countdown.** S.2561 (statewide phone-free mandate, Fall 2026) — small banner / footer with the deadline so users see why districts will move.

4. **Filter by tier.** Add a filter (radio buttons under the legend) that lets the user show only tier-1, tier-2, tier-3, or all. Useful for advocacy targeting.

5. **Population-weighted summary.** "X% of MA public-school students live in a tier-3 district." Compute from town populations × district mapping × policy tier. Show in legend footer.

6. **Export.** "Download data" link in the legend that grabs `phone-policies.json` and the GEOID map for downstream use.

---

## P3 — Code-quality polish (only if everything else is done)

- Code-split the bundle (vite warning: 2MB single chunk).
- Add a `data-testid` on each toggle so the next debug session can hit them programmatically via Chrome MCP.
- Memoize `sizeScore` more aggressively if districts list churns.

---

## How to use Chrome MCP for in-browser verification

You have `mcp__claude-in-chrome__*` tools (load via `ToolSearch query="claude-in-chrome"`). Workflow:
1. `tabs_context_mcp` to get/create a tab.
2. `navigate` to `https://allaire-matthew.github.io/ma-power-map/`. Wait ~10s after a push for GH Pages to deploy.
3. `read_page filter=interactive` to see toggles and buttons.
4. `read_console_messages` after every navigation to catch errors silently.
5. To bypass cache after a deploy: navigate to `?v=<random>` or use `javascript_tool` to call `location.reload(true)`.
6. Use `gif_creator` if you want to capture a multi-step interaction for the final report.

---

## Self-pacing protocol

After each work block:
1. If a build is running in the background → `ScheduleWakeup` 60–120s.
2. If you just pushed and need to wait for GH Pages → `ScheduleWakeup` 90s.
3. If you're between tasks → `ScheduleWakeup` 1200–1800s.
4. If you finish all P0+P1 → write the final report and stop scheduling.
5. If you've been running ~6 hours total → write the final report and stop scheduling.

When ScheduleWakeup fires, re-read this file to re-anchor on the punch list. Don't drift.

---

## Off-limits

- Do not touch `~/Documents/Obsidian Vault/05-Secure/`.
- Do not change Matthew's git config, do not force-push, do not push to anything other than `main` on `allaire-matthew/ma-power-map`.
- Do not delete the existing seed entries in `phone-policies.json` even if you suspect them — append/correct in place.
- Do not invent district policies. If a search returns nothing after 5 queries, leave the district out (or mark tier 1 confidence:low with a "no policy located" note).

---

## Starting checklist (run on first wake)

1. `cd ~/code/ma-power-map && git status && git log --oneline -5` — confirm starting commit.
2. Read this file end to end.
3. Open the deployed site in Chrome MCP, take a screenshot, save to `/tmp/session-start.png` for diff at end.
4. Begin P0.1.
