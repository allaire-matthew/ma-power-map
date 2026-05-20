#!/usr/bin/env python3
"""Refresh public/data/town-orgs.json from the CIRL IRL-Councils Google Sheet.

The Sheet ID is hardcoded (Matthew's CIRL workbench sheet). Fetches via the
Sheets CSV-export endpoint, which works without auth for sheets shared
'Anyone with the link' OR via stored OAuth (handled by the workflow secret).

Workflow option: if CIRL_SHEET_CSV_URL env var is set, use that direct CSV
URL instead — useful for swapping data sources without code changes.
"""
from __future__ import annotations
import csv
import io
import json
import os
import pathlib
import sys
import urllib.request
from datetime import date

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "public" / "data"

# Sheet ID for the CIRL workbench; tab = 'IRL Councils' (gid=1097363314 → confirmed).
SHEET_ID = "16q_wrfljGEbMuUyeAeovZKk_TVTuoGgUf7mqb1uLqtw"
GID = "1097363314"
CSV_URL = (
    os.environ.get("CIRL_SHEET_CSV_URL")
    or f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
)

UA = "Mozilla/5.0 (compatible; ma-power-map-refresh/1.0)"


def fetch_csv(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def norm_town(s: str) -> str:
    s = (s or "").strip().lower()
    # West Newton (village in Newton) → Newton
    if s == "west newton":
        return "newton"
    return s


def main() -> int:
    print(f"Fetching org sheet from {CSV_URL}", file=sys.stderr)
    try:
        text = fetch_csv(CSV_URL)
    except Exception as e:
        print(f"FAIL: could not fetch sheet: {e}", file=sys.stderr)
        return 1

    reader = csv.DictReader(io.StringIO(text))
    by_town: dict[str, list[dict]] = {}
    rowcount = 0
    for row in reader:
        rowcount += 1
        town = norm_town(row.get("Town", ""))
        if not town:
            continue
        name = (row.get("Name", "") or "").strip()
        entry = {
            "org": (row.get("Org", "") or "").strip(),
            "chapterName": (row.get("Group", "") or "").strip(),
            "town": (row.get("Town", "") or "").strip(),
            "leadName": name if name and name != "—" else None,
            "leadEmail": (row.get("Email", "") or "").strip() or None,
            "type": (row.get("Type", "") or "").strip(),
            "notes": (row.get("Notes", "") or "").strip() or None,
        }
        by_town.setdefault(town, []).append(entry)

    if rowcount < 5:
        print(f"FAIL: only {rowcount} rows parsed — refusing to write", file=sys.stderr)
        return 1

    out = {
        "_schemaVersion": 1,
        "_lastUpdated": date.today().isoformat(),
        "_source": f"Google Sheet {SHEET_ID} / IRL Councils tab.",
        "byTown": by_town,
    }

    out_path = DATA_DIR / "town-orgs.json"
    existing = json.loads(out_path.read_text()) if out_path.exists() else {}

    def stable(d: dict) -> str:
        d2 = {k: v for k, v in d.items() if k != "_lastUpdated"}
        return json.dumps(d2, sort_keys=True)
    if existing and stable(existing) == stable(out):
        print("No changes vs existing town-orgs.json.", file=sys.stderr)
        return 0

    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes, {len(by_town)} towns)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
