import { useEffect, useState } from 'react'
import {
  getTownToDistrict,
  loadLayer,
  loadPhonePolicies,
  loadSchoolCommitteeLinks,
  normalizeDistrictKey,
  type PhonePolicy,
  type PhoneTier,
  type ProjectedFeature,
  type SchoolCommitteeLink,
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setTown(null)
    setDistrictName(null)
    setPolicy(null)
    setSchoolLink(null)
    ;(async () => {
      const [townsLayer, districtsLayer, policies, tToD, scLinks] =
        await Promise.all([
          loadLayer('towns'),
          loadLayer('schoolDistricts'),
          loadPhonePolicies(),
          getTownToDistrict(),
          loadSchoolCommitteeLinks(),
        ])
      if (cancelled) return
      const tf = townsLayer.features.find((f) => f.id === townId) ?? null
      const dId = tToD[townId]
      const df = dId
        ? districtsLayer.features.find((f) => f.id === dId) ?? null
        : null
      const pol = dId ? policies[dId] ?? null : null
      // Try lookup by district name first, then town name as fallback.
      const dKey = df ? normalizeDistrictKey(df.name) : null
      const tKey = tf ? normalizeDistrictKey(tf.name) : null
      const link =
        (dKey && scLinks[dKey]) || (tKey && scLinks[tKey]) || null
      setTown(tf)
      setDistrictName(df?.name ?? null)
      setPolicy(pol)
      setSchoolLink(link)
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
        </div>

        <PhonePolicyBlock policy={policy} loading={loading} hasDistrict={!!districtName} />

        <EventsBlock townName={town?.name ?? null} />
      </div>
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
                      {s.publisher}
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
