import {
  getTownToDistrict,
  getTownToLayer,
  loadAiPilotDistricts,
  loadEdTechActions,
  loadEdTechServices,
  loadLayer,
  loadLegislators,
  loadNextMeetings,
  loadPhonePolicies,
  loadSchoolCommitteeLinks,
  loadTownOrgs,
  normalizeDistrictKey,
  type DevicePosture,
  type EdTechAction,
  type EdTechProfile,
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
  edtech: EdTechProfile | null
  edtechPosture: DevicePosture | null // null = district not yet researched
  aiPilot: boolean // district is in the statewide AI-curriculum pilot
  edtechActions: EdTechAction[] // resistance ledger — actions/bodies/officials
  schoolLink: SchoolCommitteeLink | null
  nextMeeting: NextMeetingEntry | null
  orgs: TownOrgChapter[]
  usHouse: USHouseRep | null
  maSenate: StateLegislator | null
  maHouse: StateLegislator | null
}

export type World = {
  towns: ProjectedFeature[] // all town features (map + search)
  records: Map<string, TownRecord> // by town GEOID
  byKey: Map<string, TownRecord> // by normalized name
  tracked: TownRecord[] // towns with local groups, sorted
  legislators: LegislatorsData | null
  kpis: {
    localGroupTowns: number
    localGroups: number
    towns2plus: number
    tier4: number
    tier3: number
    tier2: number
    tier1: number
    districtsTotal: number
    meetingsNext14d: number
    edtechProfiled: number
    edtechTakeHome: number
    aiPilotDistricts: number
    edtechActionTowns: number
    edtechBodies: number
    edtechOfficials: number
  }
  freshness: { label: string; date: string | null }[]
}

let worldPromise: Promise<World> | null = null

export function loadWorld(): Promise<World> {
  if (worldPromise) return worldPromise
  worldPromise = buildWorld()
  return worldPromise
}

// Classify a district's 1:1 posture from its free-text takeHome field
// (research prose, not an enum). Take-home when the text opens with
// "yes"/"grades …" or affirmatively mentions devices going home once
// negated clauses ("no longer go home", "no public evidence of
// take-home", "not found/confirmed") are scrubbed; explicit
// "no"/"in-classroom"/"in-school" openers mean in-school; a documented
// 1:1 with no affirmative take-home signal defaults to in-school.
// Total: any oneToOne shape (missing, exists false/null) → 'none'.
export function classifyDevicePosture(one: EdTechProfile['oneToOne'] | null | undefined): DevicePosture {
  if (!one || one.exists !== true) return 'none'
  const t = (one.takeHome ?? '').trim().toLowerCase()
  if (!t) return 'none'
  if (/^(yes|grades?\b)/.test(t)) return 'takeHome'
  if (/^(no\b|in[- ]?(classroom|school))/.test(t)) return 'inSchool'
  const scrubbed = t
    .replace(/no longer[^;.,)]*/g, '')
    .replace(/no (public )?evidence[^;.,)]*/g, '')
    .replace(/[^;.,()]*not (found|confirmed)[^;.,)]*/g, '')
  if (/\b(yes|take[- ]home|take[^;.,]{0,24}home|go(es)? home|at home|travel)\b/.test(scrubbed)) {
    return 'takeHome'
  }
  return 'inSchool'
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
    meetings,
    edtechByDistrict,
    aiPilot,
    edtechActions,
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
    loadNextMeetings(),
    loadEdTechServices(),
    loadAiPilotDistricts(),
    loadEdTechActions(),
  ])

  const aiPilotIds = new Set((aiPilot?.districts ?? []).map((d) => d.districtId))

  // Data keys that don't match a map-town name (verified 2026-07-03).
  // "Martha's Vineyard" is an island-wide group — anchored to Tisbury
  // (Vineyard Haven).
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
  const edtechActionsByTown: Record<string, EdTechAction[]> = {}
  for (const [k, v] of Object.entries(edtechActions?.byTown ?? {})) {
    const key = canon(k)
    edtechActionsByTown[key] = [...(edtechActionsByTown[key] ?? []), ...v]
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
    const edtech = dId ? edtechByDistrict[dId] ?? null : null
    const rec: TownRecord = {
      id: f.id,
      key,
      name: f.name,
      population: f.population ?? null,
      countyName: county?.name ?? null,
      districtId: dId,
      districtName: district?.name ?? null,
      policy,
      edtech,
      edtechPosture: edtech ? classifyDevicePosture(edtech.oneToOne) : null,
      aiPilot: dId ? aiPilotIds.has(dId) : false,
      edtechActions: edtechActionsByTown[key] ?? [],
      schoolLink: (dKey && scLinks[dKey]) || scLinks[tKey] || null,
      nextMeeting: (dKey && meetings?.byKey[dKey]) || meetings?.byKey[tKey] || null,
      orgs: orgsByTown[key] ?? [],
      usHouse: legislators?.us_house[tToCong[f.id] ?? ''] ?? null,
      maSenate: legislators?.ma_senate[tToSen[f.id] ?? ''] ?? null,
      maHouse: legislators?.ma_house[tToHouse[f.id] ?? ''] ?? null,
    }
    records.set(f.id, rec)
    byKey.set(key, rec)
  }

  const tracked = [...records.values()]
    .filter((r) => r.orgs.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const allPolicies = Object.values(policies)
  const meetingsNext14d = Object.values(meetings?.byKey ?? {}).filter((m) => {
    if (!m.next_meeting) return false
    const d = daysSince(m.next_meeting)
    return d != null && d <= 0 && d >= -14
  }).length

  const isAdvocate = (t: string) => t.toLowerCase().includes('advocate')
  const allOrgEntries = tracked.flatMap((r) => r.orgs)
  const edtechProfiles = Object.values(edtechByDistrict)
  const allEdtechActionEntries = Object.values(edtechActionsByTown).flat()
  const kpis = {
    localGroupTowns: tracked.length,
    localGroups: allOrgEntries.filter((o) => (o.chapterName ?? '').trim() && !isAdvocate(o.type)).length,
    towns2plus: tracked.filter((r) => r.orgs.length >= 2).length,
    tier4: allPolicies.filter((p) => p.tier === 4).length,
    tier3: allPolicies.filter((p) => p.tier === 3).length,
    tier2: allPolicies.filter((p) => p.tier === 2).length,
    tier1: allPolicies.filter((p) => p.tier === 1).length,
    districtsTotal: allPolicies.length,
    meetingsNext14d,
    edtechProfiled: edtechProfiles.length,
    edtechTakeHome: edtechProfiles.filter(
      (p) => classifyDevicePosture(p.oneToOne) === 'takeHome',
    ).length,
    aiPilotDistricts: aiPilot?.districts.length ?? 0,
    edtechActionTowns: Object.keys(edtechActionsByTown).filter(
      (k) => edtechActionsByTown[k].some((a) => a.kind === 'action'),
    ).length,
    edtechBodies: allEdtechActionEntries.filter((a) => a.kind === 'body').length,
    edtechOfficials: allEdtechActionEntries.filter((a) => a.kind === 'official').length,
  }

  const freshness: World['freshness'] = [
    { label: 'Parent orgs', date: townOrgs?._lastUpdated ?? null },
    { label: 'Meetings', date: meetings?._lastUpdated ?? null },
    { label: 'EdTech pushback', date: edtechActions?._lastUpdated ?? null },
  ]

  return {
    towns: townsLayer.features,
    records,
    byKey,
    tracked,
    legislators,
    kpis,
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
