#!/usr/bin/env python3
"""Refresh public/data/legislators.json from malegislature.gov.

Scrapes the public Senate + House member directories, parses 9-column tables,
matches each member to ma-state-{senate,house}.geojson GEOIDs by normalized
district name, and writes the merged data file.

Idempotent: writes only on diff vs. existing file. Exits 0 on success
(whether or not data changed). Non-zero exit means scrape failed.

Run locally: python3 scripts/refresh_legislators.py
Run in CI:   handled by .github/workflows/refresh-data.yml
"""
from __future__ import annotations
import json
import pathlib
import re
import sys
import urllib.request
from collections import Counter
from datetime import date

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
GEO_DIR = REPO_ROOT / "public" / "geo"
DATA_DIR = REPO_ROOT / "public" / "data"

SENATE_URL = "https://malegislature.gov/Legislators/Members/Senate"
HOUSE_URL = "https://malegislature.gov/Legislators/Members/House"

UA = "Mozilla/5.0 (compatible; ma-power-map-refresh/1.0; +https://github.com/allaire-matthew/ma-power-map)"

ORDS = {
    "1st": "1", "2nd": "2", "3rd": "3", "4th": "4", "5th": "5",
    "6th": "6", "7th": "7", "8th": "8", "9th": "9", "10th": "10",
    "11th": "11", "12th": "12", "13th": "13", "14th": "14", "15th": "15",
    "16th": "16", "17th": "17", "18th": "18", "19th": "19", "20th": "20",
    "21st": "21", "22nd": "22", "23rd": "23", "24th": "24", "25th": "25",
    "26th": "26", "27th": "27", "28th": "28", "29th": "29", "30th": "30",
    "31st": "31", "32nd": "32", "33rd": "33", "34th": "34",
    "first": "1", "second": "2", "third": "3", "fourth": "4", "fifth": "5",
    "sixth": "6", "seventh": "7", "eighth": "8", "ninth": "9", "tenth": "10",
    "eleventh": "11", "twelfth": "12", "thirteenth": "13",
    "fourteenth": "14", "fifteenth": "15", "sixteenth": "16",
    "seventeenth": "17", "eighteenth": "18", "nineteenth": "19",
    "twentieth": "20", "twenty-first": "21", "twenty-second": "22",
    "twenty-third": "23", "twenty-fourth": "24",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def norm_district(s: str) -> str:
    """Canonicalize a district name so 'Middlesex and Suffolk' ≠ 'Suffolk and
    Middlesex'. Token ORDER is preserved (those are different districts)."""
    s = s.lower().strip()
    s = re.sub(r"\bdistrict\b", "", s)
    for k, v in ORDS.items():
        s = re.sub(r"\b" + re.escape(k) + r"\b", v, s)
    parts = re.split(r",|-|\s+and\s+", s)
    parts = [re.sub(r"\s+", " ", p).strip() for p in parts if p.strip()]
    return "|".join(parts)


def parse_chamber(html: str) -> list[dict]:
    rows = re.findall(r"<tr>(.*?)</tr>", html, re.S)
    members = []
    for r in rows:
        pic = re.search(
            r"pictureCol[^>]*>.*?href=\"(/Legislators/Profile/([A-Za-z0-9_%]+))\"",
            r, re.S,
        )
        if not pic:
            continue
        member_id = pic.group(2)
        tds = re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)
        if len(tds) < 6:
            continue

        def strip(s: str) -> str:
            s = re.sub(r"<[^>]+>", " ", s)
            return re.sub(r"\s+", " ", s).strip()

        first, last = strip(tds[2]), strip(tds[3])
        district, party = strip(tds[4]), strip(tds[5])
        if not first or not last:
            continue
        members.append({
            "name": f"{first} {last}",
            "district": district,
            "party": party[0] if party else None,
            "profile_id": member_id,
            "url": f"https://malegislature.gov/Legislators/Profile/{member_id}",
        })
    return members


def build_lookup(geojson_path: pathlib.Path) -> dict[str, tuple[str, str]]:
    gj = json.loads(geojson_path.read_text())
    return {
        norm_district(f["properties"]["name"]): (
            f["properties"]["GEOID"], f["properties"]["name"]
        )
        for f in gj["features"]
    }


def match_to_geoids(members: list[dict], lookup: dict) -> dict:
    out = {}
    for m in members:
        k = norm_district(m["district"])
        if k not in lookup:
            print(f"  WARN: no GEOID match for {m['district']!r} → {m['name']}", file=sys.stderr)
            continue
        geoid, gname = lookup[k]
        out[geoid] = {
            "district_name": gname,
            "name": m["name"],
            "party": m["party"],
            "url": m["url"],
            "profile_id": m["profile_id"],
        }
    return out


def main() -> int:
    print("Fetching MA Senate directory...", file=sys.stderr)
    sen_html = fetch(SENATE_URL)
    print("Fetching MA House directory...", file=sys.stderr)
    hou_html = fetch(HOUSE_URL)

    sen_members = parse_chamber(sen_html)
    hou_members = parse_chamber(hou_html)
    print(f"Parsed Senate: {len(sen_members)}, House: {len(hou_members)}", file=sys.stderr)

    sen_lookup = build_lookup(GEO_DIR / "ma-state-senate.geojson")
    hou_lookup = build_lookup(GEO_DIR / "ma-state-house.geojson")
    ma_senate = match_to_geoids(sen_members, sen_lookup)
    ma_house = match_to_geoids(hou_members, hou_lookup)
    print(f"Matched Senate: {len(ma_senate)}, House: {len(ma_house)}", file=sys.stderr)

    # Sanity floors so a bad scrape doesn't nuke the data file.
    if len(ma_senate) < 35:
        print(f"FAIL: only {len(ma_senate)} senators matched — refusing to write", file=sys.stderr)
        return 1
    if len(ma_house) < 140:
        print(f"FAIL: only {len(ma_house)} house members matched — refusing to write", file=sys.stderr)
        return 1

    out_path = DATA_DIR / "legislators.json"
    existing = json.loads(out_path.read_text()) if out_path.exists() else {}
    merged = {
        "_schemaVersion": 1,
        "_lastUpdated": date.today().isoformat(),
        "_notes": (
            "us_house = 9 verified MA federal reps (manually maintained). "
            "ma_senate + ma_house = MA Legislature (current session), refreshed "
            "from malegislature.gov by scripts/refresh_legislators.py."
        ),
        "us_house": existing.get("us_house", {}),
        "ma_senate": ma_senate,
        "ma_house": ma_house,
        "ma_senate_directory_url": SENATE_URL,
        "ma_house_directory_url": HOUSE_URL,
    }

    # Diff vs existing (ignoring _lastUpdated)
    def stable(d: dict) -> str:
        d2 = {k: v for k, v in d.items() if k != "_lastUpdated"}
        return json.dumps(d2, sort_keys=True)
    if existing and stable(existing) == stable(merged):
        print("No changes vs existing legislators.json.", file=sys.stderr)
        return 0

    out_path.write_text(json.dumps(merged, indent=2) + "\n")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
