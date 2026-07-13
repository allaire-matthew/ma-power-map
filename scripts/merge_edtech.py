#!/usr/bin/env python3
"""Merge per-region edtech research JSON (from research runs) into
public/data/edtech-services.json.

Usage: python3 scripts/merge_edtech.py part1.json [part2.json ...]

Each part is an array of district objects with the research schema
(districtName, oneToOne, lms, aiPolicy, aiPilot, aiPilotNote, aiTools,
notableServices, dpaRegistry, contracts, publicCommentary, sources).
Normalization: takeHome coerced to string|null; dpaRegistry gains an
approxApproved integer parsed from its free-text note when present.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "edtech-services.json"


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
    districts = {}
    for p in paths:
        for d in json.loads(Path(p).read_text()):
            # Long parenthetical qualifiers belong in prose, not the name.
            paren = re.search(r"\((.*)\)\s*$", d["districtName"])
            d["districtName"] = re.sub(r"\s*\(.*\)\s*$", "", d["districtName"]).strip()
            if paren and not d.get("districtNote"):
                d["districtNote"] = paren.group(1)
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
