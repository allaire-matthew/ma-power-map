import {
  getTownToDistrict,
  getTownToLayer,
  loadChapterPipeline,
  loadLayer,
  loadLegislators,
  loadNextMeetings,
  loadPhonePolicies,
  loadSchoolCommitteeLinks,
  loadTownOrgs,
  normalizeDistrictKey,
  type ChapterPipelineEntry,
  type LegislatorsData,
  type NextMeetingEntry,
  type PhonePolicy,
  type ProjectedFeature,
  type SchoolCommitteeLink,
  type StateLegislator,
  type TownOrgChapter,
  type USHouseRep,
} from './geo'

// ---------------------------------------------------------------------------
// Health heuristics — verbatim from the Pipeline Tracker's Evaluation
// Scorecard rules of thumb. The Sheet's own Status column stays the
// ground truth; these produce advisory flags shown alongside it.

// ---------------------------------------------------------------------------
// World model — every feed joined once, consumed everywhere.

export type TownRecord = {
  id: string // GEOID
  key: string // normalized lowercase name
  name: string
  population: number | null
  countyName: string | null
  districtId: string | null
  districtName: string | null
  policy: PhonePolicy | null
  schoolLink: SchoolCommitteeLink | null
  nextMeeting: NextMeetingEntry | null
  orgs: TownOrgChapter[]
  pipeline: ChapterPipelineEntry | null
  usHouse: USHouseRep | null
  maSenate: StateLegislator | null
  maHouse: StateLegislator | null
}

export type World = {
  towns: ProjectedFeature[] // all town features (map + search)
  records: Map<string, TownRecord> // by town GEOID
  byKey: Map<string, TownRecord> // by normalized name
  tracked: TownRecord[] // towns with orgs or pipeline, sorted
  legislators: LegislatorsData | null
  kpis: {
    chapters: number
    prospectTowns: number
    localGroups: number
    towns2plus: number
    tier4: number
    tier3: number
    tier2: number
    tier1: number
    districtsTotal: number
    meetingsNext14d: number
    engagedSupporters: number
  }
  stageCounts: number[] // index = stage 0–5 (chapters only)
  freshness: { label: string; date: string | null }[]
}

let worldPromise: Promise<World> | null = null

export function loadWorld(): Promise<World> {
  if (worldPromise) return worldPromise
  worldPromise = buildWorld()
  return worldPromise
}

async function buildWorld(): Promise<World> {
  const [
    townsLayer,
    districtsLayer,
    countiesLayer,
    policies,
    tToD,
    tToCounty,
    tToCong,
    tToSen,
    tToHouse,
    scLinks,
    legislators,
    townOrgs,
    pipeline,
    meetings,
  ] = await Promise.all([
    loadLayer('towns'),
    loadLayer('schoolDistricts'),
    loadLayer('counties'),
    loadPhonePolicies(),
    getTownToDistrict(),
    getTownToLayer('counties'),
    getTownToLayer('congressional'),
    getTownToLayer('stateSenate'),
    getTownToLayer('stateHouse'),
    loadSchoolCommitteeLinks(),
    loadLegislators(),
    loadTownOrgs(),
    loadChapterPipeline(),
    loadNextMeetings(),
  ])

  // Data keys that don't match a map-town name (verified 2026-07-03).
  // "Martha's Vineyard" is an island-wide chapter — anchored to Tisbury
  // (Vineyard Haven); the chapter name still says island-wide.
  const ALIAS: Record<string, string> = {
    braintree: 'braintree town',
    manchester: 'manchester-by-the-sea',
    'marthas vineyard': 'tisbury',
  }
  const canon = (key: string) => ALIAS[key] ?? key
  const orgsByTown: Record<string, TownOrgChapter[]> = {}
  for (const [k, v] of Object.entries(townOrgs?.byTown ?? {})) {
    const key = canon(k)
    orgsByTown[key] = [...(orgsByTown[key] ?? []), ...v]
  }
  const pipelineByTown: Record<string, ChapterPipelineEntry[]> = {}
  for (const [k, v] of Object.entries(pipeline?.byTown ?? {})) {
    pipelineByTown[canon(k)] = v
  }

  const records = new Map<string, TownRecord>()
  const byKey = new Map<string, TownRecord>()

  for (const f of townsLayer.features) {
    const key = (f.name || '').trim().toLowerCase()
    const dId = tToD[f.id] ?? null
    const district = dId ? districtsLayer.features.find((d) => d.id === dId) ?? null : null
    const policy = dId ? policies[dId] ?? null : null
    const dKey = district ? normalizeDistrictKey(district.name) : null
    const tKey = normalizeDistrictKey(f.name)
    const ctyId = tToCounty[f.id]
    const county = ctyId ? countiesLayer.features.find((c) => c.id === ctyId) ?? null : null
    const rec: TownRecord = {
      id: f.id,
      key,
      name: f.name,
      population: f.population ?? null,
      countyName: county?.name ?? null,
      districtId: dId,
      districtName: district?.name ?? null,
      policy,
      schoolLink: (dKey && scLinks[dKey]) || scLinks[tKey] || null,
      nextMeeting: (dKey && meetings?.byKey[dKey]) || meetings?.byKey[tKey] || null,
      orgs: orgsByTown[key] ?? [],
      pipeline: pipelineByTown[key]?.[0] ?? null,
      usHouse: legislators?.us_house[tToCong[f.id] ?? ''] ?? null,
      maSenate: legislators?.ma_senate[tToSen[f.id] ?? ''] ?? null,
      maHouse: legislators?.ma_house[tToHouse[f.id] ?? ''] ?? null,
    }
    records.set(f.id, rec)
    byKey.set(key, rec)
  }

  const tracked = [...records.values()]
    .filter((r) => r.orgs.length > 0 || r.pipeline)
    .sort((a, b) => {
      // Chapters first (by stage desc), then prospects alphabetically.
      const sa = a.pipeline ? a.pipeline.stage : -1
      const sb = b.pipeline ? b.pipeline.stage : -1
      if (sa !== sb) return sb - sa
      return a.name.localeCompare(b.name)
    })

  const stageCounts = [0, 0, 0, 0, 0, 0]
  let engaged = 0
  for (const r of tracked) {
    if (r.pipeline) {
      stageCounts[r.pipeline.stage] = (stageCounts[r.pipeline.stage] ?? 0) + 1
      engaged += r.pipeline.engagedSupporters ?? 0
    }
  }

  const allPolicies = Object.values(policies)
  const meetingsNext14d = Object.values(meetings?.byKey ?? {}).filter((m) => {
    if (!m.next_meeting) return false
    const d = daysSince(m.next_meeting)
    return d != null && d <= 0 && d >= -14
  }).length

  const isAdvocate = (t: string) => t.toLowerCase().includes('advocate')
  const allOrgEntries = tracked.flatMap((r) => r.orgs)
  const kpis = {
    chapters: tracked.filter((r) => r.pipeline).length,
    prospectTowns: tracked.filter((r) => !r.pipeline && r.orgs.length > 0).length,
    localGroups: allOrgEntries.filter((o) => (o.chapterName ?? '').trim() && !isAdvocate(o.type)).length,
    towns2plus: tracked.filter((r) => r.orgs.length >= 2).length,
    tier4: allPolicies.filter((p) => p.tier === 4).length,
    tier3: allPolicies.filter((p) => p.tier === 3).length,
    tier2: allPolicies.filter((p) => p.tier === 2).length,
    tier1: allPolicies.filter((p) => p.tier === 1).length,
    districtsTotal: allPolicies.length,
    meetingsNext14d,
    engagedSupporters: engaged,
  }

  const freshness: World['freshness'] = [
    { label: 'Chapter pipeline', date: pipeline?._lastUpdated ?? null },
    { label: 'Parent orgs', date: townOrgs?._lastUpdated ?? null },
    { label: 'Meetings', date: meetings?._lastUpdated ?? null },
  ]

  return {
    towns: townsLayer.features,
    records,
    byKey,
    tracked,
    legislators,
    kpis,
    stageCounts,
    freshness,
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (DESIGN.md E3 — one precision per metric).

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtAgo(iso: string | null | undefined): string {
  const d = daysSince(iso)
  if (d == null) return '—'
  if (d <= 0) return 'today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}
