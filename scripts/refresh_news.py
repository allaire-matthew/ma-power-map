#!/usr/bin/env python3
"""Refresh public/data/news.json — MA news for the dashboard's News view.

Sources (all keyless, verified 2026-07-03):
  * Google News RSS per tracked town (chapter-pipeline + town-orgs towns),
    scoped to the CIRL lanes (phones / schools / kids & screens).
  * Statewide feeds with full-text-free access: CommonWealth Beacon, WBUR,
    Itemlive — filtered to lane keywords.

Output schema (consumed by src/model.ts loadNews):
  { "_schemaVersion": 1, "_lastUpdated": ISO, "items": [
      {"title", "url", "source", "date": ISO|null,
       "town": normalized-town-key|null, "topic": "lane"|"civic"} ] }

Every fetch failure is non-fatal: log to stderr, keep going, and if
nothing at all was fetched leave the previous file in place.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "public" / "data"
OUT = DATA_DIR / "news.json"

UA = "Mozilla/5.0 (compatible; ma-power-map-refresh/1.0)"

LANE_WORDS = re.compile(
    r"cell ?phone|smartphone|phone-?free|screen ?time|screens?\b|social media|"
    r"yondr|bell.to.bell|online safety|age verification|digital wellness|"
    r"youth mental health|childhood independence|chronic absenteeism",
    re.I,
)

# Keep per-town queries lane-tight; civic catch-all terms stay narrow so
# the feed doesn't fill with zoning stories.
# Non-MA / tabloid noise that slips through Google News town queries.
JUNK = re.compile(r"australia|sky news|daily mail|\buk\b|triggered with|lawsuit payout|law firm|sokolove", re.I)

# A statewide item must actually read as Massachusetts — title or a known-MA outlet.
MA_MARK = re.compile(
    r"massachusetts|mass\.|\bMA\b|beacon hill|state house|state senate|boston|"
    r"wbur|wgbh|masslive|commonwealth beacon|itemlive|globe|herald",
    re.I,
)

CIVIC_WORDS = re.compile(
    r"school committee|school board|superintendent|select board|town meeting|"
    r"schools?\b|students?\b|parents?\b|youth\b",
    re.I,
)

TOWN_QUERY = (
    '"{town}" Massachusetts '
    '("school committee" OR "cell phone" OR smartphone OR "screen time" '
    'OR "phone-free" OR "social media")'
)

STATEWIDE_FEEDS = [
    ("CommonWealth Beacon", "https://commonwealthbeacon.org/feed/"),
    ("WBUR", "https://www.wbur.org/feed"),
    ("Itemlive", "https://itemlive.com/feed/"),
]

MAX_PER_TOWN = 3
MAX_STATEWIDE = 10
MAX_TOTAL = 220


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def parse_rss(raw: bytes) -> list[dict]:
    """Minimal RSS 2.0 item parser -> [{title, link, pubDate, source}]."""
    out: list[dict] = []
    root = ET.fromstring(raw)
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        src = (item.findtext("source") or "").strip()
        if title and link:
            out.append({"title": title, "link": link, "pubDate": pub, "source": src})
    return out


def iso_date(rfc822: str) -> str | None:
    try:
        return parsedate_to_datetime(rfc822).astimezone(timezone.utc).date().isoformat()
    except Exception:
        return None


def google_news_items(query: str, when: str = "14d") -> list[dict]:
    q = urllib.parse.quote(f"{query} when:{when}")
    url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
    return parse_rss(fetch(url))


def clean_gnews_title(title: str, source: str) -> tuple[str, str]:
    """Google News titles end in ' - Publisher'; split it out."""
    if source:
        suffix = f" - {source}"
        if title.endswith(suffix):
            return title[: -len(suffix)].strip(), source
    if " - " in title:
        head, _, tail = title.rpartition(" - ")
        if 0 < len(tail) <= 60:
            return head.strip(), tail.strip()
    return title, source or "Google News"


def tracked_towns() -> list[str]:
    towns: set[str] = set()
    for fname in ("chapter-pipeline.json", "town-orgs.json"):
        try:
            data = json.loads((DATA_DIR / fname).read_text())
            towns.update(k for k in data.get("byTown", {}) if k)
        except Exception as e:
            print(f"WARN: could not read {fname}: {e}", file=sys.stderr)
    return sorted(towns)


def main() -> int:
    items: list[dict] = []
    seen: set[str] = set()
    fetched_anything = False

    def add(title: str, url: str, source: str, date: str | None, town: str | None):
        key = url or title
        if key in seen:
            return
        seen.add(key)
        items.append(
            {
                "title": title,
                "url": url,
                "source": source,
                "date": date,
                "town": town,
                "topic": "lane" if LANE_WORDS.search(title) else "civic",
            }
        )

    towns = tracked_towns()
    print(f"Refreshing news for {len(towns)} tracked towns", file=sys.stderr)
    for town in towns:
        try:
            raw_items = google_news_items(TOWN_QUERY.format(town=town.title()))
            fetched_anything = True
        except Exception as e:
            print(f"WARN: Google News failed for {town}: {e}", file=sys.stderr)
            continue
        kept = 0
        for it in raw_items:
            if kept >= MAX_PER_TOWN:
                break
            title, source = clean_gnews_title(it["title"], it["source"])
            # Google sometimes loosens the OR terms — require the town name
            # in the title OR a lane keyword, so pure noise drops out. Only
            # credit the story to the town when the town is actually in the
            # title; lane stories that merely surfaced via the town query
            # go in the statewide bucket instead of mislabeling a town.
            # Case-sensitive, word-bounded: several MA town names are
            # common words ("Reading", "Marion") — a lowercase hit like
            # "reading renaissance" must not be credited to the town.
            # Only credit stories that name the town (capitalized,
            # word-bounded) AND are lane- or governance-relevant. No
            # statewide promotion from town queries — the curated MA
            # feeds own the statewide section, keeping provenance clean.
            if re.search(rf"\b{re.escape(town.title())}\b", title) is None:
                continue
            if not (LANE_WORDS.search(title) or CIVIC_WORDS.search(title)):
                continue
            if JUNK.search(title) or JUNK.search(source):
                continue
            add(title, it["link"], source, iso_date(it["pubDate"]), town)
            kept += 1
        time.sleep(0.6)  # politeness between Google News queries

    # Statewide sweep via Google News — Massachusetts + lane terms.
    try:
        sw = google_news_items(
            'Massachusetts ("cell phone" OR smartphone OR "phone-free" OR '
            '"social media" OR "screen time" OR "online safety") (school OR kids OR teens OR legislature)',
            when="7d",
        )
        fetched_anything = True
        kept = 0
        for it in sw:
            if kept >= MAX_STATEWIDE:
                break
            title, source = clean_gnews_title(it["title"], it["source"])
            if not LANE_WORDS.search(title):
                continue
            if JUNK.search(title) or JUNK.search(source):
                continue
            if not (MA_MARK.search(title) or MA_MARK.search(source)):
                continue
            town_hit = next(
                (t for t in towns if re.search(rf"\b{re.escape(t.title())}\b", title)),
                None,
            )
            add(title, it["link"], source, iso_date(it["pubDate"]), town_hit)
            kept += 1
    except Exception as e:
        print(f"WARN: statewide Google News failed: {e}", file=sys.stderr)

    for source_name, feed_url in STATEWIDE_FEEDS:
        try:
            raw_items = parse_rss(fetch(feed_url))
            fetched_anything = True
        except Exception as e:
            print(f"WARN: feed failed {source_name}: {e}", file=sys.stderr)
            continue
        kept = 0
        for it in raw_items:
            if kept >= MAX_STATEWIDE:
                break
            if not LANE_WORDS.search(it["title"]):
                continue
            town_hit = next(
                (t for t in towns if re.search(rf"\b{re.escape(t.title())}\b", it["title"])),
                None,
            )
            add(it["title"], it["link"], source_name, iso_date(it["pubDate"]), town_hit)
            kept += 1

    if not fetched_anything:
        print("FAIL: no source could be fetched; keeping previous news.json", file=sys.stderr)
        return 1

    items.sort(key=lambda i: i["date"] or "", reverse=True)
    items = items[:MAX_TOTAL]

    OUT.write_text(
        json.dumps(
            {
                "_schemaVersion": 1,
                "_lastUpdated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "_source": "Google News RSS per tracked town + CommonWealth Beacon / WBUR / Itemlive feeds",
                "items": items,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n"
    )
    print(f"Wrote {len(items)} items to {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
