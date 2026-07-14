#!/usr/bin/env python3
"""Merge per-batch EdTech-opposition research JSON into
public/data/edtech-actions.json.

Usage: python3 scripts/merge_edtech_actions.py part1.json [part2.json ...]

Each part is an array of entry objects (see RESEARCH_SPEC_EDTECH_ACTIONS.md
for the research contract):
{
  "districtId": "NCES id or null",
  "town": "Town name (map join key)",
  "kind": "action" | "body" | "official",
  "what": "one sentence",
  "actor": {"name": "...", "role": "...", "body": "..."},
  "date": "...",
  "status": "passed | pending | rejected | standing | proposed" (optional),
  "lane": "1:1 | monitoring | screen-time | AI | data-privacy | spending",
  "sources": [{"url": "...", "publisher": "...", "date": "..."}]
}

Entries key by town (lowercased) — the same join key as
public/data/town-orgs.json's byTown map, so the merge needs no
districtId resolution. districtId is carried through when supplied, for
cross-reference with edtech-services.json / phone-policies.json.
"""
import json
import sys
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
OUT = DATA / "edtech-actions.json"

REQUIRED = {"town", "kind", "what", "lane", "sources"}
VALID_KIND = {"action", "body", "official"}
VALID_LANE = {"1:1", "monitoring", "screen-time", "AI", "data-privacy", "spending"}
VALID_STATUS = {"passed", "pending", "rejected", "standing", "proposed"}


def main(paths):
    by_town = {}
    n = 0
    for p in paths:
        for e in json.loads(Path(p).read_text()):
            missing = REQUIRED - e.keys()
            if missing:
                sys.exit(f"entry missing {missing}: {str(e.get('what', '?'))[:60]}")
            if e["kind"] not in VALID_KIND:
                sys.exit(f"invalid kind {e['kind']!r}: {e['what'][:60]}")
            if e["lane"] not in VALID_LANE:
                sys.exit(f"invalid lane {e['lane']!r}: {e['what'][:60]}")
            if e.get("status") and e["status"] not in VALID_STATUS:
                sys.exit(f"invalid status {e['status']!r}: {e['what'][:60]}")
            if not e["sources"]:
                sys.exit(f"no sources: {e['what'][:60]}")
            key = e["town"].strip().lower()
            by_town.setdefault(key, []).append(e)
            n += 1

    for town in sorted(by_town):
        print(f"  {len(by_town[town]):>2}  {town}")

    out = {
        "_schemaVersion": 1,
        "_lastUpdated": date.today().isoformat(),
        "_notes": (
            "The resistance side of the EdTech ledger — on-the-record actions "
            "limiting or challenging classroom technology, district/town "
            "governance bodies reviewing it, and officials on record with "
            "concerns about screens, 1:1 programs, edtech spending, student "
            "data privacy, or AI in schools. Complements edtech-services.json "
            "(what districts run). Every entry needs a primary or press "
            "source; no vibes."
        ),
        "byTown": {k: by_town[k] for k in sorted(by_town)},
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {OUT} with {n} entries across {len(by_town)} towns")


if __name__ == "__main__":
    main(sys.argv[1:])
