#!/usr/bin/env python3
"""
Generate the 'Closest to Tier 4' progress report for MA phone policy.

Reads:
  public/data/phone-policies.json
  public/data/district-demographics.json

Writes:
  CLOSEST_TO_TIER_4.md  (at repo root)
  CLOSEST_TO_TIER_4.pdf (if pandoc + Chrome are available)

Run after any red-team pass that updates phone-policies.json.
"""
import json
import datetime
import pathlib
import subprocess
import sys
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
POLICIES = ROOT / "public" / "data" / "phone-policies.json"
DEMOS = ROOT / "public" / "data" / "district-demographics.json"
OUT_MD = ROOT / "CLOSEST_TO_TIER_4.md"
OUT_PDF = ROOT / "CLOSEST_TO_TIER_4.pdf"
TODAY = datetime.date.today().isoformat()


CONCERN_KEYWORDS = [
    "scope_lt_k12", "off_and_away", "accessible_storage", "lockers",
    "backpacks", "pockets", "educational_use_exception", "emergency_use_exception",
    "admin_discretion", "principal_discretion", "senior_exemption", "no_district_policy",
    "school_by_school", "class_only", "class_time_only", "lunch_passing_access",
    "pilot_only", "not_yet_in_operation", "no_hardware", "no_yondr",
    "storage_method_not_mandated", "504_not_enumerated", "written_agreement_carve_out",
    "no_data_collection", "teacher_discretion", "no_post_rollout_confirmation",
    "hs_only", "ms_hs_only", "k_5_off_and_away", "unverified_K_12",
    "cross_state_hallucination", "colorado_not_ma", "partial_rollout",
    "student_workaround", "principal_set_not_formal", "no_unified_K12",
]


def concern_tokens(text: str) -> list[str]:
    """Extract canonical concern keywords from a chIdxConcerns string."""
    t = text.lower().replace("_", " ")
    out = [k for k in CONCERN_KEYWORDS if k.lower().replace("_", " ") in t]
    return out or ["other"]


def render_advocacy_intel(policies: dict) -> str:
    """Aggregate the most common concerns across red-team-verified districts."""
    counter: Counter = Counter()
    by_token: defaultdict = defaultdict(list)
    verified = 0
    for p in policies.values():
        if not p.get("redTeamVerified"):
            continue
        verified += 1
        for c in p.get("chIdxConcerns") or []:
            for tok in concern_tokens(c):
                counter[tok] += 1
                by_token[tok].append(p["districtName"])

    lines = []
    add = lines.append
    add("## Statewide advocacy intel — where the leverage is\n")
    add(
        f"Across the {verified} red-team-verified districts in this tracker, the most common "
        "barriers to tier 4 cluster as follows. Each row tells the ED which lever moves the most "
        "districts forward.\n"
    )
    for tok, n in counter.most_common(10):
        if tok == "other":
            continue
        examples = sorted(set(by_token[tok]))[:5]
        ex = ", ".join(examples)
        if len(by_token[tok]) > len(examples):
            ex += f", +{len(by_token[tok]) - len(examples)} more"
        add(f"- **{n}×** `{tok}` — {ex}")
    add("")
    return "\n".join(lines)


def distance_score(p: dict) -> int:
    """Higher = closer to tier 4. Tier weight dominates."""
    tier = p.get("tier", 1)
    strengths = len(p.get("chIdxStrengths") or [])
    concerns = len(p.get("chIdxConcerns") or [])
    return (tier * 100) + strengths - (concerns * 3)


def render_markdown(policies: dict, demos: dict) -> str:
    candidates = [
        (did, p)
        for did, p in policies.items()
        if p.get("tier") != 4
        and p.get("redTeamVerified")
        and (p.get("chIdxStrengths") or p.get("chIdxConcerns"))
    ]
    candidates.sort(key=lambda x: -distance_score(x[1]))

    lines: list[str] = []
    add = lines.append

    add("# Closest to Tier 4 — MA Phone Policy Progress Report\n")
    add(f"*Snapshot of the no-mistakes MA Power Map tracker. Generated {TODAY}.*\n")
    add("")
    add(
        "This report ranks Massachusetts public school districts by their distance to the "
        "Childhood Index gold standard for phone-free schools — **bell-to-bell + inaccessible "
        "storage + K-12 + all PEDs + narrow exceptions (IEP/504 + documented medical only).** "
        "Each district below has been verified through district records + news + social media "
        "triangulation.\n"
    )
    add("")
    add(
        "For each district, this report names the **exact change** that would clear the tier-4 "
        "bar — what to ask the school committee to revise.\n"
    )

    # Tier 4
    add("## Districts at Tier 4 (gold standard, today)\n")
    tier4 = [p for p in policies.values() if p.get("tier") == 4]
    for p in tier4:
        add(f"### {p['districtName']}\n")
        add(f"**Summary:** {p.get('policySummary', '')}\n")
        if p.get("chIdxConcerns"):
            add("\n**chIdx concerns still flagged (loopholes, but not disqualifying):**")
            for c in p["chIdxConcerns"]:
                add(f"- {c}")
        add(
            f"\n**Sources verified:** {len(p.get('sources', []))} "
            "(district records + news + social media triangulation)\n"
        )

    add("\n---\n")

    # Tier 3
    add("## Closest to Tier 4 — Tier 3 districts\n")
    add(
        "These districts have inaccessible-storage hardware policies but are held back by "
        "scope < K-12 or by specific weakening loopholes.\n"
    )
    shown = 0
    for did, p in candidates:
        if p.get("tier") != 3:
            continue
        if shown >= 15:
            break
        shown += 1
        demo = demos.get(did, {}) or {}
        enr = demo.get("enrollment") or p.get("enrollment")
        add(f"\n### {shown}. {p['districtName']}")
        meta = f"scope: {p.get('scope', '—')} · enforcement: {p.get('enforcement', '—')}"
        if enr:
            meta = f"Enrollment ~{enr:,} · " + meta
        add(f"*{meta}*\n")
        add("**Strengths:**")
        for s in p.get("chIdxStrengths") or []:
            add(f"- {s}")
        add("\n**What needs to change to clear tier 4:**")
        for c in p.get("chIdxConcerns") or []:
            add(f"- {c}")
        srcs = p.get("sources") or []
        top = next(
            (s for s in srcs if isinstance(s, dict) and s.get("type") in ("district", "news")),
            srcs[0] if srcs else None,
        )
        if isinstance(top, dict) and top.get("url"):
            add(
                f"\n**Primary source:** "
                f"[{top.get('publisher', 'source')} — {top.get('date', '')}]({top['url']})"
            )

    add("\n---\n")

    # Tier 2 notable
    add("## Notable Tier 2 districts\n")
    add(
        "These districts have policies on the books but lack inaccessible-storage hardware. The "
        "Childhood Index spec considers off-and-away (pockets, backpacks, lockers) materially "
        "weaker than removal-from-possession (Yondr, locked cabinets).\n"
    )
    shown = 0
    for did, p in candidates:
        if p.get("tier") != 2:
            continue
        if shown >= 10:
            break
        shown += 1
        demo = demos.get(did, {}) or {}
        enr = demo.get("enrollment") or p.get("enrollment")
        add(f"\n### {shown}. {p['districtName']}")
        meta = f"scope: {p.get('scope', '—')} · enforcement: {p.get('enforcement', '—')}"
        if enr:
            meta = f"Enrollment ~{enr:,} · " + meta
        add(f"*{meta}*\n")
        add("**Why it's tier 2:**")
        for c in (p.get("chIdxConcerns") or [])[:5]:
            add(f"- {c}")
        if p.get("chIdxStrengths"):
            add("\n**Existing strengths:**")
            for s in p["chIdxStrengths"][:4]:
                add(f"- {s}")

    add("\n---\n")
    add(render_advocacy_intel(policies))
    add("\n---\n")
    add("## Methodology\n")
    add(
        "- All entries red-team verified across **district records (school committee minutes, "
        "BoardDocs, district handbooks)**, **news coverage (local papers, regional outlets, "
        "statewide press)**, and **social media (Facebook, X, Reddit, student newspapers)**."
    )
    add(
        "- Tier system anchored to the **Childhood Index / Distraction-Free Schools Policy "
        "Project Model Bill** spec."
    )
    add(
        "- Federal medical / IEP / 504 accommodations are allowed at every tier; "
        "superintendent / principal discretion is allowed at tier 4; emergency-use and "
        "educational-use exceptions are flagged as loopholes but not auto-disqualifying."
    )
    add(
        "- The **Statewide mandate (S.2561)** takes effect September 1, 2026 — all MA public "
        "school districts will be required to implement bell-to-bell phone-free policies. This "
        "report tracks who's ahead of that mandate and who has the strongest implementation today."
    )
    add("\n*— Generated by the MA Power Map red-team. Source: https://allaire-matthew.github.io/ma-power-map/*")
    return "\n".join(lines)


def write_pdf(md_path: pathlib.Path, pdf_path: pathlib.Path) -> bool:
    """Render md → HTML via pandoc, then HTML → PDF via Chrome headless."""
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not pathlib.Path(chrome).exists():
        return False
    if subprocess.run(["which", "pandoc"], capture_output=True).returncode != 0:
        return False
    css = ROOT / "scripts" / "report.css"
    if not css.exists():
        css.write_text("""
@page { size: Letter; margin: 0.85in 0.8in; }
body { font-family: 'Iowan Old Style', 'Charter', Georgia, serif; font-size: 11pt; line-height: 1.5; color: #0f172a; }
h1 { font-size: 20pt; margin: 0 0 0.2em 0; }
h2 { font-size: 14pt; margin: 1.5em 0 0.4em 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.18em; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 1.2em 0 0.3em 0; color: #1e293b; page-break-after: avoid; }
p { margin: 0.5em 0; }
ul { margin: 0.3em 0 0.7em 1.3em; padding: 0; }
li { margin: 0.18em 0; }
em { color: #475569; }
hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1.6em 0; }
a { color: #4338ca; text-decoration: none; }
""".strip())
    html_path = pathlib.Path("/tmp/c2t4.html")
    subprocess.run(
        ["pandoc", str(md_path), "-o", str(html_path), f"--css={css}", "--metadata", "title=", "--standalone"],
        check=True,
    )
    subprocess.run(
        [chrome, "--headless=new", "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}", f"file://{html_path}"],
        check=True,
        capture_output=True,
    )
    return True


def main() -> int:
    if not POLICIES.exists() or not DEMOS.exists():
        print("missing data files", file=sys.stderr)
        return 1
    policies = json.loads(POLICIES.read_text())["policies"]
    demos = json.loads(DEMOS.read_text())["demographics"]
    md = render_markdown(policies, demos)
    OUT_MD.write_text(md)
    print(f"wrote {OUT_MD} ({OUT_MD.stat().st_size} bytes)")
    try:
        if write_pdf(OUT_MD, OUT_PDF):
            print(f"wrote {OUT_PDF} ({OUT_PDF.stat().st_size} bytes)")
        else:
            print("skipped PDF — pandoc or Chrome missing")
    except Exception as e:
        print(f"PDF render failed: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
