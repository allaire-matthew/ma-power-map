# MA School District Phone Policy Research Spec — V2

**Owner:** Matthew Allaire (Commonwealth IRL)
**Output file:** `public/data/phone-policies.json`
**Audience:** Claude Teams agent running this as a long-form research project
**Replaces:** `RESEARCH_SPEC_PHONE_POLICIES.md` (v1). V1 produced too many low-confidence, aggregator-sourced entries. V2 raises the evidence bar.

## Why V2 exists
Initial pass of 9 districts (Boston, Fall River, Methuen, Newton, Brookline, Westford, Salem, Newburyport, Ipswich, plus Brockton) was incrementally regraded once district-specific primary sources were consulted — three of the original tier assignments were wrong. Lessons from that pass:

- **Aggregator stories (Boston Globe roundups, Axios, Govtech) collapse important within-district detail** — Newton looked tier 3 in roundups but is actually K-8 hardware + 9-12 off-and-away.
- **Tier 3 (hardware K-12) is rare.** None of the 10 seeded districts cleared the bar. Default skepticism.
- **Per-school overlays** (e.g., BPS Yondr at ~31 schools on top of district off-and-away baseline) need to be captured, not flattened.
- **Effective dates matter** — many policies pre-date the statewide bill (S.2561) and were locally driven.

## Universe size
- **80+ MA districts** are reported to have some form of phone restriction (Globe / Axios coverage).
- **77 districts** received the DESE Fund Code 729 "Approaches to Address Student Cellphone Use Pilot Grant" — that grant list is the **highest-leverage input**. Get it.
- 306 total districts in `public/geo/ma-school-districts.geojson`.
- Statewide ban (S.2561) Senate-passed July 2025; not yet through House. Mandate effective Fall 2026 if enacted.

## Tiers
1. **Tier 1 — None.** No district-level cell phone policy in force. Individual schools or teachers may have rules; nothing district-wide.
2. **Tier 2 — Partial.** District-level policy exists but is either (a) limited to K–8 / MS-only / HS-only / 6-12 / 7-12 (anything short of every grade band the district serves), or (b) "off and away" / honor-system style with no hardware-level separation (no Yondr-style locking pouches, no locked storage requirement).
3. **Tier 3 — Full hardware ban.** District requires hardware-level separation (Yondr pouches, locked phone caddies, magnetic lockers, or equivalent) for every school day, K–12 (or for every grade band the district serves).

## Per-district JSON entry (unchanged from v1)
```json
{
  "districtId": "GEOID from ma-school-districts.geojson",
  "districtName": "...",
  "tier": 1 | 2 | 3,
  "policySummary": "1–2 sentences plainly describing the policy.",
  "scope": "K-12 | K-8 | 9-12 | varies",
  "enforcement": "hardware | off-and-away | honor | none",
  "effectiveDate": "YYYY-MM",
  "enrollment": null,
  "sources": [...],
  "lastVerified": "YYYY-MM-DD",
  "confidence": "high | medium | low"
}
```

## Evidence bar (NEW)
- **Two-source rule for tier 3.** Don't assign tier 3 with only one source. Require either (a) a district-published handbook/code-of-conduct excerpt + a local-news report, or (b) two independent local-news reports from different publications.
- **Primary-source preference, in this order:**
  1. District handbook / Code of Conduct (PDF or web page on the district's domain). Search with `site:<district-domain>`.
  2. School committee minutes / approved policy (often on BoardDocs or the district website).
  3. District-specific local news (Patch, Wicked Local, town newspaper, town blog).
  4. Statewide aggregator (Globe, WBUR, Axios, Govtech, CBS Boston) — usable as a corroborator, NOT as a sole source.
- **Reject "considering" / "piloting"**. Only enacted, in-force policies count.
- **Date-stamp every policy.** Effective school year (`YYYY-09`) or month if known.

## Per-school resolution (NEW)
Many districts have inconsistent policies across schools (Boston has Yondr at 31 schools out of ~120; Newton differs at HS vs MS). Capture this in `policySummary`. If hardware coverage is partial within a district, the district is tier 2, not tier 3 — but the summary should name the schools that DO have hardware so the data is useful for a school-level zoom-in later.

## Workflow per district
1. **Start with the DESE pilot grant list.** Fund Code 729 awarded to ~77 districts — every awardee has at least an in-flight policy. Source the list from `https://www.doe.mass.edu/grants/awards.html` (or contact DESE if not published).
2. **Search district website:** `site:<district domain> "cell phone" OR "personal device" OR "Yondr"`.
3. **Search school committee:** `"<district> school committee" "cell phone" 2023..2026`.
4. **Search local news:** `<district> phone ban OR pouch OR Yondr site:patch.com OR site:wickedlocal.com OR site:bostonglobe.com OR site:wbur.org OR site:cbsnews.com OR site:boston25news.com OR site:nbcboston.com`.
5. **Cross-reference statewide round-ups** — but only as corroborators.
6. If nothing found after 5 queries → tier 1, confidence "low", note "no policy located as of <date>".

## Quality gates before commit
- [ ] Tier 3 has ≥2 independent sources, at least one primary.
- [ ] `policySummary` names the enforcement mechanism (Yondr / pouch / pocket chart / off-and-away) explicitly.
- [ ] `policySummary` names the grade scope (K-12, 7-12, etc.) explicitly.
- [ ] `effectiveDate` set to YYYY-MM.
- [ ] At least one source URL points to a district domain or local-news domain (not aggregator-only).
- [ ] Confidence stamped honestly: "low" if you wouldn't bet the rent on it.

## Enrollment
- Pull from MA DESE district profile: `https://profiles.doe.mass.edu/general/general.aspx?orgcode=<orgcode>&orgtypecode=5`. The orgcode is the GEOID prefix (last 4 digits + leading zero pad to 8: e.g. GEOID 2503090 → orgcode 03450000 — confirm before scraping).
- If unknown, leave `null`. The map's size-gradient layer falls back to polygon area.

## Update cadence
- After S.2561 (Fall 2026 deadline), every tier-1 will need to be reviewed.
- Spot-check tier-3 every 12 months.
- Tier-1 spot-check quarterly while the policy landscape is moving.

## Hand-off contract
- Read `public/geo/ma-school-districts.geojson` for the canonical 306-district list.
- Produce `public/data/phone-policies.json` keyed by `districtId`.
- **Append to existing entries** — don't overwrite verified rows. Bump `lastVerified` when re-checking.
- Commit each batch: `data: refresh phone policies (<N> districts updated)` with the full list of districts in the body.

## Known seed coverage (10 districts as of 2026-04-30)
Boston, Fall River, Methuen, Newton, Brookline, Westford, Salem, Newburyport, Ipswich, Brockton. Most at confidence:high after primary-source pass; Newburyport and Ipswich remain confidence:low pending district handbook fetch. **The remaining ~296 districts need work — start with the 77-district DESE Fund Code 729 awardee list.**
