#!/usr/bin/env python3
"""Merge per-region edtech research JSON (from research runs) into
public/data/edtech-services.json.

Usage: python3 scripts/merge_edtech.py part1.json [part2.json ...]

Each part is an array of district objects with the research schema
(districtName, oneToOne, lms, aiPolicy, aiPilot, aiPilotNote, aiTools,
notableServices, dpaRegistry, contracts, publicCommentary, sources).
Normalization: takeHome coerced to string|null; dpaRegistry gains an
approxApproved integer parsed from its free-text note when present;
every district gains an NCES districtId resolved against
phone-policies.json district names (the map joins on it).
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
OUT = DATA / "edtech-services.json"
PHONE_POLICIES = DATA / "phone-policies.json"

# Names whose suffix-stripped form doesn't match a phone-policies district
# (e.g. hyphenation differs: "Somerset Berkley" vs "Somerset-Berkley").
DISTRICT_ID_OVERRIDES = {
    "Somerset Berkley Regional School District": "2500541",
}


def norm_district(name):
    """Lowercase; 'Public Schools of X' -> 'x'; strip org-type suffixes."""
    s = name.strip().lower()
    m = re.match(r"^(?:the\s+)?public schools of (.+)$", s)
    if m:
        s = m.group(1)
    s = re.sub(r"\s+(regional school district|school district|public schools)$", "", s)
    return s.strip()


def build_district_ids():
    """normalized name -> NCES id, from phone-policies.json."""
    policies = json.loads(PHONE_POLICIES.read_text())["policies"]
    ids = {}
    for did, pol in policies.items():
        key = norm_district(pol["districtName"])
        if key in ids and ids[key] != did:
            # Ambiguous key: force an explicit override rather than guess.
            ids[key] = None
        else:
            ids[key] = did
    return ids


def norm_take_home(v):
    if v is None or isinstance(v, str):
        return v
    return "yes" if v else "no"


def parse_approved(note):
    if not note:
        return None
    m = re.search(r"(\d+)\s+(?:entries\s+)?(?:marked\s+|resources,?\s+\d*\s*)?[Aa]pproved", note)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s+marked\s+Approved", note)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s+(?:public\s+)?(?:resource\s+)?(?:agreement\s+)?(?:agreements|entries|rows)", note)
    if m:
        return int(m.group(1))
    return None


def main(paths):
    district_ids = build_district_ids()
    districts = {}
    for p in paths:
        for d in json.loads(Path(p).read_text()):
            # Long parenthetical qualifiers belong in prose, not the name.
            paren = re.search(r"\((.*)\)\s*$", d["districtName"])
            d["districtName"] = re.sub(r"\s*\(.*\)\s*$", "", d["districtName"]).strip()
            if paren and not d.get("districtNote"):
                d["districtNote"] = paren.group(1)
            d["districtId"] = DISTRICT_ID_OVERRIDES.get(
                d["districtName"]
            ) or district_ids.get(norm_district(d["districtName"]))
            # Some research runs return lms entries as {name, source} objects.
            d["lms"] = [x["name"] if isinstance(x, dict) else x for x in (d.get("lms") or [])]
            one = d.get("oneToOne") or {}
            one["takeHome"] = norm_take_home(one.get("takeHome"))
            d["oneToOne"] = one
            reg = d.get("dpaRegistry") or {}
            if reg.get("approxApproved") is None:
                reg["approxApproved"] = parse_approved(reg.get("note"))
            d["dpaRegistry"] = reg
            districts[d["districtName"]] = d

    unresolved = [n for n, d in districts.items() if not d.get("districtId")]
    for name, d in sorted(districts.items()):
        print(f"  {d.get('districtId') or 'UNRESOLVED':>8}  {name}")
    if unresolved:
        sys.exit(f"no districtId for: {', '.join(unresolved)} — add to DISTRICT_ID_OVERRIDES")

    out = {
        "_schemaVersion": 1,
        "_lastUpdated": date.today().isoformat(),
        "_notes": (
            "District EdTech usage listing — 1:1 device programs, platforms, AI tools/policies, "
            "notable services, contracts, and student-data-privacy agreements. Compiled from district "
            "technology pages, handbooks, school-committee minutes, budget documents, local press, and "
            "the SDPC/Massachusetts Student Privacy Alliance registry (sdpc.a4l.org). A signed privacy "
            "agreement means a tool was vetted for use, not proof of active classroom deployment. "
            "Listing only — no rating or tiering."
        ),
        "districts": sorted(districts.values(), key=lambda d: d["districtName"]),
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {OUT} with {len(districts)} districts")


if __name__ == "__main__":
    main(sys.argv[1:])
