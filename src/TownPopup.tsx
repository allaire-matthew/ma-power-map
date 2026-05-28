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

// Short tier labels for the header pill — the full TIER_LABEL is the tooltip.
const TIER_SHORT: Record<PhoneTier, string> = {
  1: 'Tier 1 · no policy',
  2: 'Tier 2 · partial',
  3: 'Tier 3 · stored',
  4: 'Tier 4 · bell-to-bell',
}

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
  const repCount =
    (usHouseRep || stateHouseName ? 1 : 0) +
    (senator || stateSenateName ? 1 : 0) +
    (houseRep || stateHouseName ? 1 : 0)

  return (
    <div
      data-map-ui
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-3 bottom-3 z-30 w-64 max-w-[calc(100vw-1.5rem)] max-h-[24rem] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl text-sm overflow-hidden"
      style={{ borderTopColor: TIER_COLOR[tier], borderTopWidth: 3 }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-3 py-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <h2 className="font-semibold text-slate-900 leading-tight truncate text-[14px]">
              {town?.name ?? (loading ? 'Loading…' : townId)}
            </h2>
            {town?.population != null && (
              <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                {town.population.toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-slate-500 leading-tight truncate">
            {districtName ?? (loading ? '…' : 'No district')}
          </div>
          <span
            className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: `${TIER_COLOR[tier]}22`, color: TIER_COLOR[tier] }}
            title={TIER_LABEL[tier]}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: TIER_COLOR[tier] }}
            />
            {TIER_SHORT[tier]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 leading-none px-0.5 -mt-0.5 text-base shrink-0"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Body — headline summary always visible; everything else is tucked
          into collapsed sections so the card stays compact by default. */}
      <div className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
        <PolicySummary policy={policy} loading={loading} hasDistrict={!!districtName} />

        <div className="mt-1">
          {policy && (
            <Section title="Policy detail">
              <PolicyDetail policy={policy} />
            </Section>
          )}

          {(districtName || loading) && (
            <Section title="School committee">
              <SchoolBlock
                loading={loading}
                districtName={districtName}
                schoolLink={schoolLink}
                nextMeeting={nextMeeting}
              />
            </Section>
          )}

          <Section title="Representatives" badge={repCount || undefined}>
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
          </Section>

          <Section title="Parent organizing" badge={orgs.length || undefined}>
            <OrgsBlock loading={loading} orgs={orgs} townName={town?.name ?? null} />
          </Section>

          <Section title="Events & links">
            <EventsBlock townName={town?.name ?? null} />
          </Section>
        </div>
      </div>
    </div>
  )
}

/** Collapsible disclosure section. Closed by default; native <details> so it
 *  works without JS and stays accessible. */
function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-slate-100 first:border-t-0"
    >
      <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none py-1.5 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          className="shrink-0 text-slate-400 transition-transform group-open:rotate-90"
          aria-hidden
        >
          <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex-1">{title}</span>
        {badge != null && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-slate-100 text-slate-600 text-[9.5px] font-semibold normal-case tracking-normal">
            {badge}
          </span>
        )}
      </summary>
      <div className="pb-2 pl-[1.125rem]">{children}</div>
    </details>
  )
}

/** Always-visible headline: the one-line phone-policy summary (or the
 *  appropriate fallback note). */
function PolicySummary({
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
      <div className="text-[12px] text-slate-500 italic leading-snug">
        {loading
          ? 'Looking up policy…'
          : hasDistrict
            ? 'No policy on file for this district. Defaults to tier 1 until researched.'
            : 'No school district found for this town.'}
      </div>
    )
  }
  return (
    <p className="text-slate-700 text-[12px] leading-snug">
      {policy.policySummary}
    </p>
  )
}

/** Expanded policy specifics — only rendered inside the collapsed section. */
function PolicyDetail({ policy }: { policy: PhonePolicy }) {
  const scope = policy.scope?.replace(/_/g, ' ')
  const enforcement = policy.enforcement?.replace(/-/g, ' ')
  const sourceCount = (policy.sources || []).length
  return (
    <div className="space-y-1.5">
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
      {policy.chIdxStrengths?.length ? (
        <ChipList kind="strength" items={policy.chIdxStrengths} />
      ) : null}
      {policy.chIdxConcerns?.length ? (
        <ChipList kind="concern" items={policy.chIdxConcerns} />
      ) : null}
      {policy.edtechNotes ? (
        <div className="text-[10.5px] text-slate-600 leading-snug">
          <span className="text-slate-400">Context: </span>
          {policy.edtechNotes}
        </div>
      ) : null}
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
  return (
    <div>
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
    return <div className="text-[11.5px] text-slate-400 italic">Loading…</div>
  }
  return (
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
  if (orgs.length === 0) {
    return (
      <div className="text-[11.5px] text-slate-400 italic">
        {loading
          ? 'Loading…'
          : `No chapter on file in ${townName ?? 'this town'}.`}
      </div>
    )
  }
  return (
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
            <div className="text-[10.5px] text-slate-500 italic">{c.notes}</div>
          )}
        </li>
      ))}
    </ul>
  )
}

function EventsBlock({ townName }: { townName: string | null }) {
  return (
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
      ? { dot: '#10b981', text: '#065f46', label: 'Strengths' }
      : { dot: '#f59e0b', text: '#92400e', label: 'Concerns' }
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
