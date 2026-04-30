# MA School District Phone Policy Research Spec

**Owner:** Matthew Allaire (Commonwealth IRL)
**Output file:** `public/data/phone-policies.json`
**Audience:** Claude Teams agent running this as an ongoing research project

## Goal
Classify every Massachusetts public school district (~306) on a 3-tier phone-restriction scale, and capture sourced detail surfaced in the map's inspect card.

## Tiers
1. **Tier 1 — None.** No district-level cell phone policy in force. Individual schools or teachers may have rules; nothing district-wide.
2. **Tier 2 — Partial.** District-level policy exists but is either (a) limited to K–8 (elementary/middle only, no enforcement at the high school level), or (b) "off and away" / honor-system style with no hardware-level separation (no Yondr-style locking pouches, no locked storage requirement).
3. **Tier 3 — Full hardware ban.** District requires hardware-level separation (Yondr pouches, locked phone caddies, magnetic lockers, or equivalent) for every school day, K–12 (or for every grade band the district serves).

## Per-district JSON entry
```json
{
  "districtId": "GEOID from ma-school-districts.geojson (e.g. 2502790)",
  "districtName": "Boston School District",
  "tier": 1,
  "policySummary": "1–2 sentences plainly describing the policy.",
  "scope": "K-12 | K-8 | 9-12 | varies",
  "enforcement": "hardware | off-and-away | honor | none",
  "effectiveDate": "YYYY-MM",
  "enrollment": 49000,
  "sources": [
    {"title": "...", "url": "...", "publisher": "...", "date": "YYYY-MM-DD"}
  ],
  "lastVerified": "YYYY-MM-DD",
  "confidence": "high | medium | low"
}
```

## Research workflow (per district)
1. **District handbook** — `"<district> public schools" "cell phone" OR "personal device" handbook site:<district domain>`
2. **School committee meetings** — `"<district> school committee" "cell phone" OR "Yondr" 2024..2026`
3. **Local news** — `<district> phone ban OR pouch site:patch.com OR site:wickedlocal.com OR site:bostonglobe.com OR site:wbur.org OR site:cbsnews.com`
4. **MA DESE / MTA bulletins** — districts cited in statewide reporting rounds.
5. **Yondr public client list** — Yondr publishes adopters in marketing materials.
6. If nothing found after 3 targeted queries → tier 1, confidence "low".

## Quality bar
- Tier 3 requires **explicit** mention of hardware (pouches, lockers, magnetic, locked) AND coverage for every grade the district serves.
- Don't infer from "considering" or "piloting" — only enacted, in-force policies count.
- Effective date = the school year the policy went into effect (`YYYY-09` etc.).
- Distinguish district policy from individual-school policy. A single Yondr school inside Boston ≠ Boston as tier 3.

## Enrollment field
- Pull from MA DESE district profile pages: `https://profiles.doe.mass.edu/general/general.aspx?orgcode=<orgcode>&orgtypecode=5`
- If unknown, leave `null` and the map falls back to polygon area for the size-gradient layer.

## Update cadence
- After the statewide ban (S.2561) takes effect Fall 2026, every tier-1 will need to move to tier 2 or 3 — re-survey late 2026.
- Spot-check tier-3 every 12 months.
- Tier-1 spot-check quarterly while the policy landscape is moving.

## Hand-off contract for Claude Teams
- Read `public/geo/ma-school-districts.geojson` for the canonical district list (306 GEOIDs).
- Produce a single `public/data/phone-policies.json` matching the schema above.
- **Append** to existing entries — don't blow away verified rows. Bump `lastVerified` when re-checking.
- Commit each batch with `data: refresh phone policies (<N> districts updated)`.

## Known seed entries
The repo ships with seed entries covering Boston, Newton, Brookline, Westford, Methuen, Fall River, Newburyport, Ipswich, Salem. Most are confidence:low — verify before relying on them. The remaining ~297 districts are unset (treated as tier 1 in the UI until they appear in the file).
