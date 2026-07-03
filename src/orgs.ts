// Registry of parent-organizing orgs that appear in town-orgs.json /
// the chapter pipeline. Domains verified by live fetch 2026-07-03 —
// logo chips render the org favicon with a monogram fallback, so a
// wrong/missing domain degrades to initials, never a wrong logo.

export type OrgInfo = {
  name: string
  short: string // monogram fallback (1–3 chars)
  domain: string | null
  url: string | null
}

const REGISTRY: OrgInfo[] = [
  { name: 'Turning Life On', short: 'TLO', domain: 'turninglifeon.org', url: 'https://turninglifeon.org' },
  { name: 'Wait Until 8th', short: 'W8', domain: 'waituntil8th.org', url: 'https://waituntil8th.org' },
  { name: 'The Balance Project', short: 'TBP', domain: 'thebalanceproject.life', url: 'https://thebalanceproject.life' },
  { name: 'ScreenStrong', short: 'SS', domain: 'screenstrong.org', url: 'https://screenstrong.org' },
  { name: 'Schools Beyond Screens', short: 'SBS', domain: 'schoolsbeyondscreens.com', url: 'https://schoolsbeyondscreens.com' },
  { name: 'Becca Schmill Foundation', short: 'BSF', domain: 'beccaschmillfdn.org', url: 'https://beccaschmillfdn.org' },
  { name: 'Distraction-Free Schools Policy Project', short: 'DF', domain: 'distractionfreeschools.com', url: 'https://distractionfreeschools.com' },
  { name: 'SFC US Leadership Council', short: 'SFC', domain: 'smartphonefreechildhoodus.com', url: 'https://smartphonefreechildhoodus.com' },
  { name: 'Lex Kids Be Kids', short: 'LKK', domain: 'lexkidsbekids.org', url: 'https://lexkidsbekids.org' },
  { name: 'South Shore Digital Wellness', short: 'SSD', domain: 'southshoredigitalwellness.org', url: 'https://southshoredigitalwellness.org' },
  { name: 'ReConnect Western MA', short: 'RC', domain: 'reconnectwma.org', url: 'https://reconnectwma.org' },
  { name: 'Commonwealth IRL', short: 'CIRL', domain: 'commonwealthirl.org', url: 'https://commonwealthirl.org' },
  // No verified domain — monogram only. (Two unrelated MA "Reconnect"
  // groups exist; Malden's isn't confidently either.)
  { name: 'Reconnect', short: 'RC', domain: null, url: null },
  { name: 'Independent', short: '—', domain: null, url: null },
]

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')

const BY_KEY = new Map<string, OrgInfo>(REGISTRY.map((o) => [norm(o.name), o]))

/**
 * Resolve an org field from the data ("Turning Life On / Wait Until 8th",
 * "Independent (EMF/wireless safety focus)") into registry entries.
 * Unknown parts fall back to a monogram-only entry built from the text.
 */
export function resolveOrgs(orgField: string, chapterName?: string | null): OrgInfo[] {
  // Strip parentheticals BEFORE splitting — "(EMF/wireless safety focus)"
  // must not split into phantom orgs.
  const cleaned = orgField.replace(/\([^)]*\)/g, ' ').trim()
  const parts = cleaned.split('/').map((p) => p.trim()).filter(Boolean)
  const out: OrgInfo[] = []
  for (const raw of parts) {
    const base = raw
    // "Independent" is the absence of an affiliation — identity comes
    // from the local group's own name when there is one, else no chip.
    if (norm(base) === 'independent') {
      if (chapterName && chapterName.trim()) {
        const words = chapterName.trim().split(/\s+/).filter((w) => w.length > 2)
        out.push({
          name: chapterName.trim(),
          short: words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('') || '?',
          domain: null,
          url: null,
        })
      }
      continue
    }
    let hit = BY_KEY.get(norm(base))
    if (!hit) {
      // Chapter names sometimes carry the real org (e.g. "ReConnect Western MA").
      for (const cand of [chapterName ?? '', base]) {
        for (const o of REGISTRY) {
          if (cand && norm(cand).includes(norm(o.name))) {
            hit = o
            break
          }
        }
        if (hit) break
      }
    }
    if (!hit) {
      const words = base.split(/\s+/).filter((w) => w.length > 2)
      hit = {
        name: base,
        short: words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('') || '?',
        domain: null,
        url: null,
      }
    }
    if (!out.some((o) => o.name === hit!.name)) out.push(hit)
  }
  return out
}

export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
}
