#!/usr/bin/env python3
"""Refresh public/data/next-school-committee-meetings.json.

For each school district in public/data/school-committee-links.json with a
real calendar_url, fetch the page and regex-extract the next upcoming meeting
date. Output is keyed by the same normalized name used in the source lookup
table.

Heuristic only — every district website is its own snowflake. We look for:
  - ISO dates (2026-06-03)
  - US dates (6/3/2026, 06/03/2026, June 3 2026)
  - Day-name + date ("Tuesday, June 3, 2026")
The first date in the future wins. If no future date is found, the entry
gets `{ "next_meeting": null, "checked": "<date>" }` so the popup can show
"No upcoming meeting on the public calendar" without re-fetching.

Run locally: python3 scripts/refresh_school_meetings.py
"""
from __future__ import annotations
import json
import pathlib
import re
import sys
import urllib.request
from datetime import date, datetime

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "public" / "data"
UA = "Mozilla/5.0 (compatible; ma-power-map-refresh/1.0)"

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

# Patterns ordered most-specific → most-general so the first match wins.
PATTERNS = [
    # "Tuesday, June 3, 2026" / "June 3, 2026"
    re.compile(
        r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*,?\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\s*,?\s*(20\d{2})\b",
        re.I,
    ),
    re.compile(
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\s*,?\s*(20\d{2})\b",
        re.I,
    ),
    # ISO 2026-06-03
    re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b"),
    # US 6/3/2026 (and 06-03-2026)
    re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b"),
]


def fetch(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            ct = r.headers.get("Content-Type", "")
            raw = r.read(800_000)  # cap at 800 KB per page
        if "html" in ct or "text" in ct:
            return raw.decode("utf-8", errors="replace")
        return raw.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  fetch failed: {e}", file=sys.stderr)
        return None


def strip_html(text: str) -> str:
    text = re.sub(r"<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>", " ", text, flags=re.I)
    text = re.sub(r"<style\b[^<]*(?:(?!</style>)<[^<]*)*</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def parse_dates(text: str, today: date) -> list[date]:
    found = []
    seen = set()
    # Word patterns
    for pat in PATTERNS[:2]:
        for m in pat.finditer(text):
            try:
                month_str, day, year = m.groups()[-3:]
                mo = MONTHS.get(month_str.lower()[:3]) or MONTHS.get(month_str.lower())
                if not mo:
                    continue
                d = date(int(year), mo, int(day))
            except (ValueError, KeyError):
                continue
            if d >= today and d not in seen:
                seen.add(d)
                found.append(d)
    # ISO YYYY-MM-DD
    for m in PATTERNS[2].finditer(text):
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            continue
        if d >= today and d not in seen:
            seen.add(d)
            found.append(d)
    # US MM/DD/YYYY
    for m in PATTERNS[3].finditer(text):
        try:
            mo, dy, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if mo > 12 or dy > 31:
                continue
            d = date(yr, mo, dy)
        except ValueError:
            continue
        if d >= today and d not in seen:
            seen.add(d)
            found.append(d)
    return sorted(found)


def main() -> int:
    links_path = DATA_DIR / "school-committee-links.json"
    if not links_path.exists():
        print(f"FAIL: {links_path} missing", file=sys.stderr)
        return 1
    links = json.loads(links_path.read_text()).get("links", {})

    # Dedupe by URL — multiple keys can point to the same district entry
    by_url: dict[str, list[str]] = {}
    for key, entry in links.items():
        url = entry.get("calendar_url", "")
        if not url or url.startswith(("TODO", "see ")):
            continue
        by_url.setdefault(url, []).append(key)

    print(f"Scraping {len(by_url)} unique calendar URLs...", file=sys.stderr)
    today = date.today()
    next_meetings: dict[str, dict] = {}
    for url, keys in by_url.items():
        print(f"  {keys[0][:35]:<35} {url[:80]}", file=sys.stderr)
        html = fetch(url)
        if html is None:
            entry = {
                "next_meeting": None,
                "checked": today.isoformat(),
                "source_url": url,
                "status": "fetch_failed",
            }
        else:
            text = strip_html(html)
            future = parse_dates(text, today)
            if future:
                entry = {
                    "next_meeting": future[0].isoformat(),
                    "additional_upcoming": [d.isoformat() for d in future[1:4]],
                    "checked": today.isoformat(),
                    "source_url": url,
                    "status": "ok",
                }
            else:
                entry = {
                    "next_meeting": None,
                    "checked": today.isoformat(),
                    "source_url": url,
                    "status": "no_future_date",
                }
        for k in keys:
            next_meetings[k] = entry

    out = {
        "_schemaVersion": 1,
        "_lastUpdated": today.isoformat(),
        "_notes": (
            "Heuristic regex-based scrape of school-committee calendar pages. "
            "Status: ok (date found), no_future_date (page parsed but no future "
            "date matched), fetch_failed (network/HTTP error). Re-run via "
            "scripts/refresh_school_meetings.py or the daily GH Action."
        ),
        "byKey": next_meetings,
    }
    out_path = DATA_DIR / "next-school-committee-meetings.json"
    existing = json.loads(out_path.read_text()) if out_path.exists() else {}

    def stable(d: dict) -> str:
        d2 = {k: v for k, v in d.items() if k != "_lastUpdated"}
        # Also strip 'checked' from each entry since that re-stamps every run
        if "byKey" in d2:
            d2 = {**d2, "byKey": {k: {**v, "checked": "x"} for k, v in d2["byKey"].items()}}
        return json.dumps(d2, sort_keys=True)
    if existing and stable(existing) == stable(out):
        print("No content changes vs existing.", file=sys.stderr)
        return 0

    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(
        f"Wrote {out_path} ({out_path.stat().st_size:,} bytes, "
        f"{sum(1 for v in next_meetings.values() if v.get('status')=='ok')} hits)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
