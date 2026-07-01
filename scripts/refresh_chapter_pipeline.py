#!/usr/bin/env python3
"""Refresh public/data/chapter-pipeline.json from the CIRL Chapter Pipeline Tracker.

The Sheet ID is hardcoded (CIRL Chapter Operations Drive folder). Fetches via
the Sheets CSV-export endpoint, same pattern as refresh_town_orgs.py — works
without auth only for sheets shared 'Anyone with the link'. As of 2026-07-01
this sheet is NOT shared that way (view access is restricted), so this script
will fail with a 401/HTML-login-page response until Matthew changes the
sharing setting. Until then, regenerate public/data/chapter-pipeline.json
manually via the google-sheets MCP.

Workflow option: if CHAPTER_SHEET_CSV_URL env var is set, use that direct CSV
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

# Sheet ID for the CIRL Chapter Pipeline Tracker; tab = 'Chapter Pipeline' (gid=1350018300 → confirmed).
SHEET_ID = "1P9EQc7thJhRSO3MiHTPQlZ_39UsGJ4YVHhYCLfFHVMo"
GID = "1350018300"
CSV_URL = (
    os.environ.get("CHAPTER_SHEET_CSV_URL")
    or f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
)

UA = "Mozilla/5.0 (compatible; ma-power-map-refresh/1.0)"

STAGE_NAMES = {
    "0": "Identified",
    "1": "Prospecting",
    "2": "Activated",
    "3": "Programming",
    "4": "Sustained",
    "5": "Network Hub",
}


def fetch_csv(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def norm_town(s: str) -> str:
    return (s or "").strip().lower()


def norm_bool(s: str) -> bool:
    return (s or "").strip().upper() in ("Y", "YES", "TRUE")


def main() -> int:
    print(f"Fetching chapter pipeline sheet from {CSV_URL}", file=sys.stderr)
    try:
        text = fetch_csv(CSV_URL)
    except Exception as e:
        print(f"FAIL: could not fetch sheet: {e}", file=sys.stderr)
        return 1

    reader = csv.DictReader(io.StringIO(text))
    by_town: dict[str, list[dict]] = {}
    rowcount = 0
    for row in reader:
        chapter = (row.get("Chapter / Community", "") or "").strip()
        if not chapter:
            continue
        rowcount += 1
        geo = (row.get("Primary Geography", "") or chapter).strip()
        town = norm_town(geo)
        stage_raw = (row.get("Stage (0-5)", "") or "").strip()
        try:
            stage = int(stage_raw)
        except ValueError:
            stage = 0
        entry = {
            "chapter": chapter,
            "primaryGeography": geo,
            "stage": stage,
            "stageName": (row.get("Stage Name", "") or STAGE_NAMES.get(stage_raw, "")).strip(),
            "status": (row.get("Status", "") or "").strip(),
            "dateEnteredStage": (row.get("Date Entered Stage", "") or "").strip() or None,
            "chapterLead": (row.get("Chapter Lead", "") or "").strip() or None,
            "leadConfirmed": norm_bool(row.get("Lead Confirmed", "")),
            "partnersCount": int((row.get("Partners (#)", "") or "0").strip() or 0),
            "anchorActivation": (row.get("Anchor Activation", "") or "").strip() or None,
            "lastPublicActivity": (row.get("Last Public Activity", "") or "").strip() or None,
            "activityType": (row.get("Activity Type", "") or "").strip() or None,
            "lastReport": (row.get("Last Report", "") or "").strip() or None,
            "nextAction": (row.get("Next Action", "") or "").strip() or None,
            "notes": (row.get("Notes", "") or "").strip() or None,
        }
        by_town.setdefault(town, []).append(entry)

    if rowcount < 1:
        print("FAIL: zero chapter rows parsed — refusing to write", file=sys.stderr)
        return 1

    out = {
        "_schemaVersion": 1,
        "_lastUpdated": date.today().isoformat(),
        "_source": f"Google Sheet {SHEET_ID} / Chapter Pipeline tab.",
        "stageNames": STAGE_NAMES,
        "byTown": by_town,
    }

    out_path = DATA_DIR / "chapter-pipeline.json"
    existing = json.loads(out_path.read_text()) if out_path.exists() else {}

    def stable(d: dict) -> str:
        d2 = {k: v for k, v in d.items() if k != "_lastUpdated"}
        return json.dumps(d2, sort_keys=True)
    if existing and stable(existing) == stable(out):
        print("No changes vs existing chapter-pipeline.json.", file=sys.stderr)
        return 0

    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes, {len(by_town)} towns)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
