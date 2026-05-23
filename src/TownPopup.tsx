import { useEffect, useState } from 'react'
import {
  getTownToDistrict,
  getTownToLayer,
  loadLayer,
  loadLegislators,
  loadNextMeetings,
  loadPhonePolicies,
  loadSchoolCommitteeLinks,
  loadTownOrgs,
  normalizeDistrictKey,
  type LegislatorsData,
  type NextMeetingEntry,
  type PhonePolicy,
  type PhoneTier,
  type ProjectedFeature,
  type SchoolCommitteeLink,
  type TownOrgChapter,
} from './geo'
import { TIER_COLOR, TIER_LABEL } from './MapBackground'

export function TownPopup({
  townId,
  onClose,
}: {
  townId: string
  onClose: () => void
}) {
  const [town, setTown] = useState<ProjectedFeature | null>(null)
  const [districtName, setDistrictName] = useState<string | null>(null)
  const [policy, setPolicy] = useState<PhonePolicy | null>(null)
  const [schoolLink, setSchoolLink] = useState<SchoolCommitteeLink | null>(null)
  const [usHouseRep, setUsHouseRep] = useState<{ name: string; party: string; url: string; district: number } | null>(null)
  const [senator, setSenator] = useState<{ name: string; party: string; url: string; districtName: string } | null>(null)
  const [houseRep, setHouseRep] = useState<{ name: string; party: string; url: string; districtName: string } | null>(null)
  const [stateSenateName, setStateSenateName] = useState<string | null>(null)
  const [stateHouseName, setStateHouseName] = useState<string | null>(null)
  const [countyName, setCountyName] = useState<string | null>(null)
  const [legislators, setLegislators] = useState<LegislatorsData | null>(null)
  const [orgs, setOrgs] = useState<TownOrgChapter[]>([])
  const [nextMeeting, setNextMeeting] = useState<NextMeetingEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setTown(null)
    setDistrictName(null)
    setPolicy(null)
    setSchoolLink(null)
    setUsHouseRep(null)
    setSenator(null)
    setHouseRep(null)
    setStateSenateName(null)
    setStateHouseName(null)
    setCountyName(null)
    setOrgs([])
    setNextMeeting(null)
    ;(async () => {
      const [
        townsLayer,
        districtsLayer,
        congressionalLayer,
        stateSenateLayer,
        stateHouseLayer,
        countiesLayer,
        policies,
        tToD,
        tToCong,
        tToSenate,
        tToHouse,
        tToCounty,
        scLinks,
        legData,
        townOrgs,
        nextMtgs,
      ] = await Promise.all([
        loadLayer('towns'),
        loadLayer('schoolDistricts'),
        loadLayer('congressional'),
        loadLayer('stateSenate'),
        loadLayer('stateHouse'),
        loadLayer('counties'),
        loadPhonePolicies(),
        getTownToDistrict(),
        getTownToLayer('congressional'),
        getTownToLayer('stateSenate'),
        getTownToLayer('stateHouse'),
        getTownToLayer('counties'),
        loadSchoolCommitteeLinks(),
        loadLegislators(),
        loadTownOrgs(),
        loadNextMeetings(),
      ])
      if (cancelled) return
      const tf = townsLayer.features.find((f) => f.id === townId) ?? null
      const dId = tToD[townId]
      const df = dId
        ? districtsLayer.features.find((f) => f.id === dId) ?? null
        : null
      const pol = dId ? policies[dId] ?? null : null
      const dKey = df ? normalizeDistrictKey(df.name) : null
      const tKey = tf ? normalizeDistrictKey(tf.name) : null
      const link = (dKey && scLinks[dKey]) || (tKey && scLinks[tKey]) || null

      // Containing federal + state + county subunits
      const congId = tToCong[townId]
      const ush = legData && congId ? legData.us_house[congId] ?? null : null
      const senId = tToSenate[townId]
      const senF = senId
        ? stateSenateLayer.features.find((f) => f.id === senId)
        : null
      const senData = legData && senId ? legData.ma_senate?.[senId] ?? null : null
      const houseId = tToHouse[townId]
      const houseF = houseId
        ? stateHouseLayer.features.find((f) => f.id === houseId)
        : null
      const houseData = legData && houseId ? legData.ma_house?.[houseId] ?? null : null
      const ctyId = tToCounty[townId]
      const ctyF = ctyId
        ? countiesLayer.features.find((f) => f.id === ctyId)
        : null
      // Silence unused-var warnings — these layers are loaded for future use.
      void congressionalLayer

      // Orgs lookup by normalized town name
      const tName = tf?.name ?? ''
      const orgKey = tName.trim().toLowerCase()
      const townOrgList =
        townOrgs && orgKey ? townOrgs.byTown[orgKey] ?? [] : []

      // Next school committee meeting — same district/town key strategy
      const nm =
        (dKey && nextMtgs?.byKey[dKey]) ||
        (tKey && nextMtgs?.byKey[tKey]) ||
        null

      setTown(tf)
      setDistrictName(df?.name ?? null)
      setPolicy(pol)
      setSchoolLink(link)
      setUsHouseRep(ush)
      setSenator(
        senData
          ? {
              name: senData.name,
              party: senData.party,
              url: senData.url,
              districtName: senData.district_name,
            }
          : null,
      )
      setHouseRep(
        houseData
          ? {
              name: houseData.name,
              party: houseData.party,
              url: houseData.url,
              districtName: houseData.district_name,
            }
          : null,
      )
      setStateSenateName(senF?.name ?? null)
      setStateHouseName(houseF?.name ?? null)
      setCountyName(ctyF?.name ?? null)
      setLegislators(legData)
      setOrgs(townOrgList)
      setNextMeeting(nm)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [townId])

  const tier: PhoneTier = policy?.tier ?? 1
  return (
    <div
      data-map-ui
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-3 bottom-3 z-30 w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl text-sm overflow-hidden"
    >
      {/* Sticky card header: town + district + tier strip. */}
      <div className="shrink-0 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2 px-3 pt-2 pb-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <div className="font-semibold text-slate-900 leading-tight truncate text-[15px]">
                {town?.name ?? (loading ? 'Loading…' : townId)}
              </div>
              {town?.population != null && (
                <div className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {town.population.toLocaleString()}
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-600 leading-tight truncate mt-0.5">
              {districtName ?? (loading ? '…' : 'No district resolved')}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 leading-none px-1 -mt-0.5 text-lg shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {/* Tier strip — the spine of the card */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]"
          style={{ background: TIER_COLOR[tier] + '15' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: TIER_COLOR[tier] }}
          />
          <span className="font-medium text-slate-800 leading-tight">
            {TIER_LABEL[tier]}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 [scrollbar-width:thin]">
        <PhonePolicyBlock policy={policy} loading={loading} hasDistrict={!!districtName} />

        <SchoolBlock
          loading={loading}
          districtName={districtName}
          schoolLink={schoolLink}
          nextMeeting={nextMeeting}
        />

        <RepsBlock
          loading={loading}
          county={countyName}
          usHouse={usHouseRep}
          senator={senator}
          houseRep={houseRep}
          stateSenateName={stateSenateName}
          stateHouseName={stateHouseName}
          legislators={legislators}
        />

        <OrgsBlock loading={loading} orgs={orgs} townName={town?.name ?? null} />

        <EventsBlock townName={town?.name ?? null} />
      </div>
    </div>
  )
}

function SchoolBlock({
  loading,
  districtName,
  schoolLink,
  nextMeeting,
}: {
  loading: boolean
  districtName: string | null
  schoolLink: SchoolCommitteeLink | null
  nextMeeting: NextMeetingEntry | null
}) {
  if (!districtName && !loading) return null
  return (
    <div className="pt-2 border-t border-slate-100">
      <SectionLabel>School committee</SectionLabel>
      {schoolLink ? (
        <a
          href={schoolLink.calendar_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[12px] text-indigo-600 hover:underline"
        >
          Committee calendar →
        </a>
      ) : (
        !loading && districtName && (
          <div className="text-[10.5px] text-slate-400 italic">
            Calendar URL not yet on file.
          </div>
        )
      )}
      <NextMeetingLine nextMeeting={nextMeeting} loading={loading} />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9.5px] uppercase tracking-wider text-slate-500 mb-1">
      {children}
    </div>
  )
}

function RepsBlock({
  loading,
  county,
  usHouse,
  senator,
  houseRep,
  stateSenateName,
  stateHouseName,
  legislators,
}: {
  loading: boolean
  county: string | null
  usHouse: { name: string; party: string; url: string; district: number } | null
  senator: { name: string; party: string; url: string; districtName: string } | null
  houseRep: { name: string; party: string; url: string; districtName: string } | null
  stateSenateName: string | null
  stateHouseName: string | null
  legislators: LegislatorsData | null
}) {
  if (loading && !county && !usHouse && !senator && !houseRep) {
    return (
      <div className="pt-1 border-t border-slate-100">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          Your representatives
        </div>
        <div className="text-[11.5px] text-slate-400 italic">Loading…</div>
      </div>
    )
  }
  return (
    <div className="pt-1 border-t border-slate-100">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        Your representatives
      </div>
      <ul className="text-[12px] space-y-1">
        {usHouse && (
          <li>
            <div className="text-[10px] text-slate-500">
              US House · District {usHouse.district} ({usHouse.party})
            </div>
            <a
              href={usHouse.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {usHouse.name} →
            </a>
          </li>
        )}
        {(senator || stateSenateName) && (
          <li>
            <div className="text-[10px] text-slate-500">
              MA Senate · {senator?.districtName ?? stateSenateName}
              {senator && ` (${senator.party})`}
            </div>
            {senator ? (
              <a
                href={senator.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {senator.name} →
              </a>
            ) : (
              <a
                href={
                  legislators?.ma_senate_directory_url ??
                  'https://malegislature.gov/Legislators/Members/Senate'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Find senator →
              </a>
            )}
          </li>
        )}
        {(houseRep || stateHouseName) && (
          <li>
            <div className="text-[10px] text-slate-500">
              MA House · {houseRep?.districtName ?? stateHouseName}
              {houseRep && ` (${houseRep.party})`}
            </div>
            {houseRep ? (
              <a
                href={houseRep.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {houseRep.name} →
              </a>
            ) : (
              <a
                href={
                  legislators?.ma_house_directory_url ??
                  'https://malegislature.gov/Legislators/Members/House'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Find representative →
              </a>
            )}
          </li>
        )}
        {county && (
          <li>
            <div className="text-[10px] text-slate-500">County</div>
            <span className="text-slate-900">{county} County</span>
          </li>
        )}
      </ul>
    </div>
  )
}

function NextMeetingLine({
  nextMeeting,
  loading,
}: {
  nextMeeting: NextMeetingEntry | null
  loading: boolean
}) {
  if (loading && !nextMeeting) return null
  if (!nextMeeting) {
    return (
      <div className="text-[10.5px] text-slate-400 italic mt-0.5">
        Next meeting: not yet scraped.
      </div>
    )
  }
  if (nextMeeting.status === 'fetch_failed') {
    return (
      <div className="text-[10.5px] text-amber-600 italic mt-0.5">
        Next meeting: calendar page unreachable on last check ({nextMeeting.checked}).
      </div>
    )
  }
  if (nextMeeting.status === 'no_future_date' || !nextMeeting.next_meeting) {
    return (
      <div className="text-[10.5px] text-slate-400 italic mt-0.5">
        Next meeting: no upcoming date listed on calendar (checked {nextMeeting.checked}).
      </div>
    )
  }
  // Format YYYY-MM-DD as readable date
  const d = new Date(nextMeeting.next_meeting + 'T00:00:00')
  const label = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return (
    <div className="text-[11.5px] text-slate-700 mt-0.5">
      <span className="text-slate-500">Next meeting:</span>{' '}
      <span className="font-medium">{label}</span>
      {nextMeeting.additional_upcoming && nextMeeting.additional_upcoming.length > 0 && (
        <span className="text-slate-400">
          {' '}
          (+{nextMeeting.additional_upcoming.length} more upcoming)
        </span>
      )}
    </div>
  )
}

function OrgsBlock({
  loading,
  orgs,
  townName,
}: {
  loading: boolean
  orgs: TownOrgChapter[]
  townName: string | null
}) {
  return (
    <div className="pt-1 border-t border-slate-100">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        Parent organizing presence
      </div>
      {orgs.length === 0 ? (
        <div className="text-[11.5px] text-slate-400 italic">
          {loading
            ? 'Loading…'
            : `No chapter on file in ${townName ?? 'this town'}.`}
        </div>
      ) : (
        <ul className="text-[12px] space-y-1.5">
          {orgs.map((c, i) => (
            <li key={i}>
              <div className="text-slate-900 font-medium">
                {c.chapterName}{' '}
                <span className="text-slate-500 font-normal">· {c.org}</span>
              </div>
              {c.leadName && (
                <div className="text-[11px] text-slate-600">
                  {c.type === 'community lead' || c.type === 'community lead (self)'
                    ? 'Lead: '
                    : 'Contact: '}
                  {c.leadName}
                  {c.leadEmail && (
                    <>
                      {' · '}
                      <a
                        href={`mailto:${c.leadEmail}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {c.leadEmail}
                      </a>
                    </>
                  )}
                </div>
              )}
              {c.notes && (
                <div className="text-[10.5px] text-slate-500 italic">
                  {c.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EventsBlock({ townName }: { townName: string | null }) {
  return (
    <div className="pt-1 border-t border-slate-100">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        Statewide events
      </div>
      <ul className="text-[12px] space-y-0.5">
        <li>
          <a
            href="https://malegislature.gov/Events"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            MA Legislature hearings →
          </a>
        </li>
        <li>
          <a
            href="https://www.boston.gov/public-notices"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Boston public notices →
          </a>
        </li>
        {townName && (
          <li>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(
                `${townName} MA town meeting calendar`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {townName} town meeting (search) →
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}

function PhonePolicyBlock({
  policy,
  loading,
  hasDistrict,
}: {
  policy: PhonePolicy | null
  loading: boolean
  hasDistrict: boolean
}) {
  if (!policy) {
    return (
      <div className="text-[12px] text-slate-500 italic">
        {loading
          ? 'Looking up policy…'
          : hasDistrict
            ? 'No policy on file for this district. Defaults to tier 1 until researched.'
            : 'No school district found for this town.'}
      </div>
    )
  }
  const scope = policy.scope?.replace(/_/g, ' ')
  const enforcement = policy.enforcement?.replace(/-/g, ' ')
  const sourceCount = (policy.sources || []).length
  return (
    <div className="space-y-1.5">
      {/* Meta row */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-500">
        <span>
          Scope <span className="text-slate-800">{scope || '—'}</span>
        </span>
        <span>
          Enf. <span className="text-slate-800">{enforcement || '—'}</span>
        </span>
        <span>
          Conf. <span className="text-slate-800">{policy.confidence}</span>
        </span>
      </div>
      {/* Summary */}
      <p className="text-slate-700 text-[12px] leading-snug">
        {policy.policySummary}
      </p>
      {/* chIdx strengths/concerns as tight, colored chips */}
      {policy.chIdxStrengths?.length ? (
        <ChipList kind="strength" items={policy.chIdxStrengths} />
      ) : null}
      {policy.chIdxConcerns?.length ? (
        <ChipList kind="concern" items={policy.chIdxConcerns} />
      ) : null}
      {/* Edtech context, only if present */}
      {policy.edtechNotes ? (
        <div className="text-[10.5px] text-slate-600 leading-snug">
          <span className="text-slate-400">Context: </span>
          {policy.edtechNotes}
        </div>
      ) : null}
      {/* Footer row: verification + source count + handbook link */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 pt-0.5">
        {policy.redTeamVerified && (
          <span className="text-emerald-600 font-medium">
            ✓ red-team verified {policy.redTeamVerified}
          </span>
        )}
        {sourceCount > 0 && (
          <span>
            · {sourceCount} source{sourceCount === 1 ? '' : 's'} on file
          </span>
        )}
        {policy.handbook_url && (
          <a
            href={policy.handbook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            · handbook PDF →
          </a>
        )}
      </div>
    </div>
  )
}

function ChipList({
  kind,
  items,
}: {
  kind: 'strength' | 'concern'
  items: string[]
}) {
  const palette =
    kind === 'strength'
      ? { dot: '#10b981', bg: '#ecfdf5', text: '#065f46', label: 'Strengths' }
      : { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', label: 'Concerns' }
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-wider mb-1"
        style={{ color: palette.text }}
      >
        {palette.label}
      </div>
      <ul className="space-y-0.5">
        {items.map((s, i) => (
          <li
            key={i}
            className="text-[10.5px] leading-snug flex items-start gap-1.5"
          >
            <span
              className="inline-block w-1 h-1 rounded-full shrink-0 mt-1.5"
              style={{ background: palette.dot }}
            />
            <span className="text-slate-700">{s.replace(/_/g, ' ')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
