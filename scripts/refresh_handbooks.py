#!/usr/bin/env python3
"""Handbook pipeline v5 — OCR support for image-only PDFs.

Adds tesseract OCR fallback when pdftotext + PyMuPDF both fail (i.e., the
PDF is scanned images). Uses pdftoppm (poppler) to rasterize pages, then
tesseract per page.

Also expands the URL candidate list: re-tries all URLs from v2 + v4
attempts that returned a PDF but no text, this time with OCR.
"""
from __future__ import annotations
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
POL = REPO / "public" / "data" / "phone-policies.json"
LINKS = REPO / "public" / "data" / "school-committee-links.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
TIMEOUT = 25
MIN_TEXT_LEN = 500
MAX_OCR_PAGES = 40  # cap to keep runtime bounded

# Re-use the classifier patterns from v4
PHONE_CONTEXT = re.compile(r"\b(cell\s*phones?|smart\s*phones?|smartphones?|cellphones?|personal\s+(?:electronic\s+)?devices?|mobile\s+(?:phones?|devices?)|electronic\s+devices?)\b", re.I)
HARDWARE_PATTERNS = [
    re.compile(r"\byondr\b", re.I),
    re.compile(r"\bmagnetic(ally)?\s+lock", re.I),
    re.compile(r"\block(ed|ing)\s+(pouch|bag|box|caddy|caddies|case)", re.I),
    re.compile(r"\bphone\s+(caddy|caddies|hotel|holder|holders|pouch)", re.I),
]
OFF_AWAY_PATTERNS = [
    re.compile(r"\b(cell\s*phones?|cellphones?|smart\s*phones?|smartphones?|personal\s+(?:electronic\s+)?devices?|electronic\s+devices?)\s+(?:may\s+not|cannot|are\s+not|will\s+not|shall\s+not|must\s+not)\s+be\s+(used|seen|visible|on)", re.I),
    re.compile(r"\b(cell\s*phones?|cellphones?|smart\s*phones?|personal\s+(?:electronic\s+)?devices?|electronic\s+devices?)[^.]{0,80}\b(turned?\s+off|silenced?|stored\s+(in\s+)?(backpack|locker|bag|pocket))", re.I),
    re.compile(r"\bphones?[^.]{0,40}(in\s+(?:the\s+)?(backpack|locker|bag))", re.I),
    re.compile(r"\b(off\s+and\s+away|away\s+for\s+the\s+day|put\s+away|stowed)\b", re.I),
    re.compile(r"\b(no\s+cell\s+phones?|no\s+smartphones?)", re.I),
    re.compile(r"\bcell\s*phones?[^.]{0,40}\bnot\s+allowed", re.I),
    re.compile(r"\b(devices?|phones?)\s+(must|will|shall)\s+(be\s+)?(turned\s+off|silenced|stored|placed)", re.I),
    re.compile(r"\bbell[-\s]to[-\s]bell\b", re.I),
]
BAD_DOMAINS = [re.compile(p, re.I) for p in [r"sau41\.org", r"apsva\.us", r"\.wpsd\.org", r"warwicksd\.org", r"\.in\.us\b", r"\.k12\.(ny|ri|ct|nj|pa|in|wi|ia|tx|ga|fl|sc|nc|va|md|ky|mo|oh|ar|me|nh|vt)\b"]]


def is_bad_domain(url: str) -> bool:
    return any(p.search(url) for p in BAD_DOMAINS)


def fetch(url: str, max_bytes: int = 5_000_000) -> tuple[bytes, str]:
    if is_bad_domain(url):
        return b"", "cross_state"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = r.read(max_bytes)
            ct = r.headers.get("Content-Type", "")
        return data, ct
    except Exception:
        return b"", ""


def looks_like_pdf(data: bytes, ct: str) -> bool:
    return data[:8].startswith(b"%PDF") or "pdf" in ct.lower()


def extract_text_with_ocr_fallback(pdf_path: pathlib.Path, workdir: pathlib.Path) -> tuple[str, str]:
    """Returns (text, method_used)."""
    # Try pdftotext
    try:
        out = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True, timeout=30)
        if len(out.stdout.strip()) >= MIN_TEXT_LEN:
            return out.stdout, "pdftotext"
    except Exception:
        pass
    # Try PyMuPDF
    try:
        import fitz
        doc = fitz.open(str(pdf_path))
        t = "\n".join(page.get_text() for page in doc)
        doc.close()
        if len(t.strip()) >= MIN_TEXT_LEN:
            return t, "pymupdf"
    except Exception:
        pass
    # OCR fallback — render pages and run tesseract
    try:
        # Rasterize first MAX_OCR_PAGES pages at 200 DPI
        prefix = workdir / "page"
        subprocess.run(
            ["pdftoppm", "-r", "200", "-l", str(MAX_OCR_PAGES), str(pdf_path), str(prefix)],
            capture_output=True, timeout=120,
        )
        text_parts = []
        for page_img in sorted(workdir.glob("page-*")):
            try:
                out = subprocess.run(
                    ["tesseract", str(page_img), "-", "-l", "eng", "--psm", "6"],
                    capture_output=True, text=True, timeout=30,
                )
                text_parts.append(out.stdout)
            except Exception:
                continue
        text = "\n".join(text_parts)
        if len(text.strip()) >= MIN_TEXT_LEN:
            return text, "ocr_tesseract"
    except Exception as e:
        print(f"  OCR failed: {e}", file=sys.stderr)
    return "", "none"


def scan_html_for_handbook_links(html: bytes, base_url: str) -> list[str]:
    text = html.decode("utf-8", errors="replace")
    anchors = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([\s\S]{0,300}?)</a>', text, re.I)
    scored = []
    for href, label in anchors:
        href_l = href.lower()
        label_l = re.sub(r"<[^>]+>", " ", label).lower()
        score = 0
        if "handbook" in href_l: score += 5
        if "handbook" in label_l: score += 5
        if "student" in href_l or "student" in label_l: score += 1
        if "family" in href_l or "family" in label_l: score += 1
        if "code of conduct" in label_l or "code-of-conduct" in href_l: score += 3
        if ".pdf" in href_l: score += 2
        if score >= 5:
            full = urllib.parse.urljoin(base_url, href)
            scored.append((score, full))
    scored.sort(reverse=True)
    seen = set()
    out = []
    for s, u in scored:
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= 5:
            break
    return out


def ddg_search_pdf(domain: str) -> list[str]:
    netloc = urllib.parse.urlparse(domain).netloc
    q = f"site:{netloc} handbook filetype:pdf"
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(q)
    data, _ = fetch(url, max_bytes=500_000)
    if not data:
        return []
    text = data.decode("utf-8", errors="replace")
    urls = re.findall(r'href="(https?://[^"]+\.pdf[^"]*)"', text, re.I)
    out = []
    for u in urls:
        if "duckduckgo.com" in u:
            m = re.search(r"uddg=([^&]+)", u)
            if m:
                u = urllib.parse.unquote(m.group(1))
        if u not in out and "handbook" in u.lower():
            out.append(u)
        if len(out) >= 3:
            break
    return out


def discover(domain: str) -> str | None:
    home, ct = fetch(domain, max_bytes=2_000_000)
    if home and "html" in ct.lower():
        candidates = scan_html_for_handbook_links(home, domain)
        for c in candidates:
            d, cct = fetch(c, max_bytes=10_000_000)
            if not d:
                continue
            if looks_like_pdf(d, cct) and len(d) > 5000:
                return c
            if "html" in cct.lower():
                deeper = scan_html_for_handbook_links(d, c)
                for d2 in deeper[:2]:
                    d3, ct3 = fetch(d2, max_bytes=10_000_000)
                    if d3 and looks_like_pdf(d3, ct3) and len(d3) > 5000:
                        return d2
    for u in ddg_search_pdf(domain):
        d, c = fetch(u, max_bytes=10_000_000)
        if d and looks_like_pdf(d, c) and len(d) > 5000:
            return u
    return None


def classify(text: str) -> tuple[int, str, str]:
    matches = list(PHONE_CONTEXT.finditer(text))
    if not matches:
        return 1, "Handbook (OCR or text): no phone-policy keywords matched.", "none"
    windows = []
    last_end = -1
    for m in matches:
        ws = max(0, m.start() - 300)
        we = min(len(text), m.end() + 1200)
        if ws <= last_end:
            windows[-1] = (windows[-1][0], we)
        else:
            windows.append((ws, we))
        last_end = we
    section = "\n---\n".join(text[ws:we] for ws, we in windows[:5])
    if any(p.search(section) for p in HARDWARE_PATTERNS):
        quote = re.sub(r"\s+", " ", section[:400]).strip()[:300]
        return 3, f"Handbook (hardware policy): {quote}", "hardware"
    if any(p.search(section) for p in OFF_AWAY_PATTERNS):
        quote = re.sub(r"\s+", " ", section[:400]).strip()[:300]
        return 2, f"Handbook (off-and-away): {quote}", "off-and-away"
    quote = re.sub(r"\s+", " ", section[:300]).strip()[:200]
    return 1, f"Handbook reviewed; no clear restriction pattern: {quote}", "none"


def derive_domain(url: str) -> str | None:
    if not url or url.startswith(("TODO", "see ")):
        return None
    try:
        p = urllib.parse.urlparse(url)
        return f"{p.scheme}://{p.netloc}"
    except Exception:
        return None


def main():
    policies = json.loads(POL.read_text())["policies"]
    links = json.loads(LINKS.read_text()).get("links", {})

    name_to_url = {}
    for k, v in links.items():
        if isinstance(v, dict) and v.get("name") and v.get("calendar_url"):
            name_to_url[v["name"].lower()] = v["calendar_url"]

    # Target: districts still tier-1 with no handbook_url
    targets = []
    for geoid, p in policies.items():
        if p.get("tier") != 1:
            continue
        if p.get("handbook_url"):
            continue
        if p.get("status") in ("intra_district_subset", "no_district_applicable"):
            continue
        name = p.get("districtName", "")
        cal_url = name_to_url.get(name.lower())
        if not cal_url:
            for key in (name.lower().replace("school district", "public schools").strip(), name.lower()):
                if key in name_to_url:
                    cal_url = name_to_url[key]
                    break
        if not cal_url:
            continue
        domain = derive_domain(cal_url)
        if not domain:
            continue
        targets.append((geoid, name, domain))

    print(f"Targets: {len(targets)}", file=sys.stderr)
    results = {}
    tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="hb5_"))
    cap = min(80, len(targets))
    for i, (geoid, name, domain) in enumerate(targets[:cap], 1):
        print(f"[{i}/{cap}] {name[:45]} → {domain}", file=sys.stderr, flush=True)
        pdf_url = discover(domain)
        if not pdf_url:
            results[geoid] = {"verified": False, "reason": "no_handbook_found", "domain_tried": domain}
            print(f"  ✗ no handbook", file=sys.stderr, flush=True)
            continue
        data, _ = fetch(pdf_url, max_bytes=15_000_000)
        if not data:
            results[geoid] = {"verified": False, "reason": "fetch_failed", "handbook_url": pdf_url}
            continue
        pdf_path = tmpdir / f"{geoid}.pdf"
        pdf_path.write_bytes(data)
        ocr_dir = tmpdir / f"{geoid}_pages"
        ocr_dir.mkdir(exist_ok=True)
        text, method = extract_text_with_ocr_fallback(pdf_path, ocr_dir)
        if len(text.strip()) < MIN_TEXT_LEN:
            results[geoid] = {"verified": False, "reason": "no_text_even_with_ocr", "handbook_url": pdf_url}
            print(f"  ⚠ no text even after OCR: {pdf_url[:70]}", file=sys.stderr, flush=True)
            continue
        tier, summary, enforcement = classify(text)
        results[geoid] = {
            "verified": True,
            "tier": tier,
            "policySummary": summary,
            "enforcement": enforcement,
            "confidence": "high",
            "handbook_url": pdf_url,
            "extraction_method": method,
            "extracted_chars": len(text),
        }
        print(f"  ✓ tier {tier} | {enforcement} | {method} | {pdf_url[:60]}", file=sys.stderr, flush=True)

    # Persist raw results for audit (useful in CI logs / debugging)
    audit_path = REPO / "scripts" / ".handbook-run-latest.json"
    audit_path.write_text(json.dumps(results, indent=2))

    # Merge verified findings into phone-policies.json
    upgrades = 0
    sources_added = 0
    rank = {"high": 3, "medium": 2, "low": 1}
    for geoid, r in results.items():
        if not r.get("verified"):
            continue
        old = policies.get(geoid, {})
        # NEVER overwrite a news-verified entry — news reports are authoritative
        # and supersede any auto-extracted handbook classification.
        if old.get("status") == "news_verified":
            print(f"  · {geoid} {old.get('districtName')}: news_verified — handbook will not override", file=sys.stderr)
            continue
        sources = list(old.get("sources", []))
        if not any(s.get("url") == r["handbook_url"] for s in sources):
            sources.append({
                "title": f"Student handbook ({r.get('extraction_method', '?')})",
                "url": r["handbook_url"],
                "publisher": "district",
                "date": "2026-05-20",
            })
        # Don't downgrade existing high-confidence entries
        if rank.get(old.get("confidence"), 1) > rank.get(r["confidence"], 1):
            old["sources"] = sources
            old["handbook_url"] = r["handbook_url"]
            sources_added += 1
            continue
        policies[geoid] = {
            **old,
            "districtId": geoid,
            "districtName": old.get("districtName", ""),
            "tier": r["tier"],
            "policySummary": r["policySummary"][:500],
            "enforcement": r["enforcement"],
            "sources": sources,
            "lastVerified": "2026-05-20",
            "confidence": r["confidence"],
            "status": "handbook_verified",
            "handbook_url": r["handbook_url"],
            "extraction_method": r.get("extraction_method", "unknown"),
        }
        upgrades += 1

    if upgrades or sources_added:
        pol_data = json.loads(POL.read_text())  # re-read to preserve _notes etc.
        pol_data["policies"] = policies
        pol_data["_lastUpdated"] = "2026-05-20"
        POL.write_text(json.dumps(pol_data, indent=2) + "\n")
        print(f"\nMerged into phone-policies.json: {upgrades} upgrades, {sources_added} source-only updates", file=sys.stderr)
    else:
        print("\nNo phone-policies.json changes.", file=sys.stderr)

    from collections import Counter
    ver = sum(1 for r in results.values() if r.get("verified"))
    tiers = Counter(r.get("tier") for r in results.values() if r.get("verified"))
    methods = Counter(r.get("extraction_method") for r in results.values() if r.get("verified"))
    print(f"Verified: {ver}/{len(results)} ({100*ver//max(len(results),1)}%)", file=sys.stderr)
    print(f"Tier distribution: {dict(tiers)}", file=sys.stderr)
    print(f"Extraction methods: {dict(methods)}", file=sys.stderr)


if __name__ == "__main__":
    main()
