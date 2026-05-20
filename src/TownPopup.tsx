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

  return (
    <div
      data-map-ui
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-3 bottom-3 z-30 w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-md shadow-xl text-sm"
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-slate-200">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Town
          </div>
          <div className="font-semibold text-slate-900 leading-tight truncate">
            {town?.name ?? (loading ? 'Loading…' : townId)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 leading-none px-1 -mt-0.5 text-lg"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-2 space-y-3">
        <div className="text-slate-700 text-[13px]">
          Population:{' '}
          <span className="font-medium tabular-nums">
            {town?.population != null
              ? town.population.toLocaleString()
              : '—'}
          </span>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
            School district
          </div>
          <div className="text-slate-900 text-[13px]">
            {districtName ?? (loading ? 'Loading…' : '—')}
          </div>
          {schoolLink && (
            <a
              href={schoolLink.calendar_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-indigo-600 hover:underline mt-0.5"
            >
              School committee calendar →
            </a>
          )}
          {!schoolLink && !loading && districtName && (
            <div className="text-[10.5px] text-slate-400 italic mt-0.5">
              Committee calendar URL not yet on file.
            </div>
          )}
          <NextMeetingLine nextMeeting={nextMeeting} loading={loading} />
        </div>

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

        <PhonePolicyBlock policy={policy} loading={loading} hasDistrict={!!districtName} />

        <EventsBlock townName={town?.name ?? null} />
      </div>
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
  const tier: PhoneTier = policy?.tier ?? 1
  return (
    <div className="space-y-1.5 pt-1 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: TIER_COLOR[tier] }}
        />
        <span className="text-xs font-medium text-slate-800">
          {TIER_LABEL[tier]}
        </span>
      </div>
      {policy ? (
        <>
          <div className="text-slate-700 text-[12.5px] leading-snug">
            {policy.policySummary}
          </div>
          <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div>Scope: <span className="text-slate-700">{policy.scope}</span></div>
            <div>Enforcement: <span className="text-slate-700">{policy.enforcement}</span></div>
            <div>Effective: <span className="text-slate-700">{policy.effectiveDate}</span></div>
            {policy.enrollment != null && (
              <div>
                Enrollment:{' '}
                <span className="text-slate-700 tabular-nums">
                  {policy.enrollment.toLocaleString()}
                </span>
              </div>
            )}
            <div className="col-span-2">
              Confidence: <span className="text-slate-700">{policy.confidence}</span>
              {' · '}Verified: <span className="text-slate-700">{policy.lastVerified}</span>
            </div>
          </div>
          {policy.handbook_url && (
            <div className="text-[12px] pt-1 border-t border-slate-100">
              <a
                href={policy.handbook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline font-medium"
              >
                Student handbook (PDF) →
              </a>
              {policy.extraction_method && (
                <span className="text-[10px] text-slate-400 ml-1.5">
                  · verified via {policy.extraction_method.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          )}
          {policy.sources.length > 0 && (
            <div className="text-[11px] pt-1 border-t border-slate-100">
              <div className="text-slate-500 mb-0.5">Sources</div>
              <ul className="space-y-0.5">
                {policy.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {s.publisher || s.title || 'Source'}
                    </a>
                    {s.date ? ` · ${s.date}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-[12px] text-slate-500 italic">
          {loading
            ? 'Looking up policy…'
            : hasDistrict
              ? 'No policy on file for this district. Defaults to tier 1 until researched.'
              : 'No school district found for this town.'}
        </div>
      )}
    </div>
  )
}
