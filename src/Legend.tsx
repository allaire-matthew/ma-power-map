import { useEffect, useState } from 'react'
import type { LayerState } from './LayerToggles'
import { STAGE_COLOR, TIER_COLOR, TIER_LABEL } from './MapBackground'
import {
  getTownToDistrict,
  loadLayer,
  loadPhonePolicies,
  type PhoneTier,
} from './geo'
import type { TierFilter } from './App'

type Coverage = {
  totalPop: number
  byTier: Record<1 | 2 | 3 | 4, number>
  unresearchedPop: number
  researchedDistrictCount: number
}

// Statewide mandate (S.2561) target effective date — front-of-2026-27 SY.
const MANDATE_DATE = new Date('2026-09-01T00:00:00')

function useCoverage(active: boolean): Coverage | null {
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void Promise.all([
      loadLayer('towns'),
      getTownToDistrict(),
      loadPhonePolicies(),
    ]).then(([towns, t2d, policies]) => {
      if (cancelled) return
      const byTier: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      let totalPop = 0
      let unresearchedPop = 0
      const seen = new Set<string>()
      for (const t of towns.features) {
        const pop = t.population ?? 0
        totalPop += pop
        const dId = t2d[t.id]
        const policy = dId ? policies[dId] : undefined
        if (policy) {
          seen.add(dId!)
          byTier[policy.tier as 1 | 2 | 3 | 4] += pop
        } else {
          unresearchedPop += pop
        }
      }
      setCoverage({
        totalPop,
        byTier,
        unresearchedPop,
        researchedDistrictCount: seen.size,
      })
    })
    return () => {
      cancelled = true
    }
  }, [active])
  return coverage
}

function formatPct(n: number, total: number): string {
  if (!total) return '—'
  return `${((n / total) * 100).toFixed(1)}%`
}

function formatDaysUntil(target: Date): { days: number; label: string } {
  const now = Date.now()
  const days = Math.ceil((target.getTime() - now) / (1000 * 60 * 60 * 24))
  if (days < 0) return { days, label: 'in effect' }
  if (days === 0) return { days, label: 'today' }
  if (days < 60) return { days, label: `in ${days} days` }
  const months = Math.round(days / 30.4)
  return { days, label: `in ~${months} months` }
}

export function Legend({
  layers,
  tierFilter,
  onTierFilter,
  onHide,
}: {
  layers: LayerState
  tierFilter: TierFilter
  onTierFilter: (t: TierFilter) => void
  onHide?: () => void
}) {
  const showPhone = layers.phoneFree
  const showSize = layers.sizeGradient
  const showParents = layers.parentPresence
  const showChapterPipeline = layers.chapterPipeline
  const showAiPilot = layers.aiPilot
  const showCounties = layers.counties
  const showCong = layers.congressional
  const showSenate = layers.stateSenate
  const showHouse = layers.stateHouse
  const showSchool = layers.schoolDistricts

  const coverage = useCoverage(showPhone)
  const mandate = formatDaysUntil(MANDATE_DATE)

  if (
    !showPhone &&
    !showSize &&
    !showParents &&
    !showChapterPipeline &&
    !showAiPilot &&
    !showCounties &&
    !showCong &&
    !showSenate &&
    !showHouse &&
    !showSchool
  )
    return null

  return (
    <aside
      data-map-ui
      className="absolute right-3 top-3 z-20 w-60 bg-white/95 backdrop-blur border border-slate-200 rounded-md shadow-lg text-[12px] text-slate-700"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {onHide && (
        <button
          type="button"
          onClick={onHide}
          title="Hide legend"
          aria-label="Hide legend"
          className="absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[13px] leading-none"
        >
          ×
        </button>
      )}
      <div className="p-3 space-y-3">
        {showPhone && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Phone-free status
            </div>
            <ul className="space-y-1">
              {[4, 3, 2, 1].map((t) => {
                const tier = t as PhoneTier
                const active = tierFilter === tier
                const dimmed = tierFilter !== 'all' && !active
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => onTierFilter(active ? 'all' : tier)}
                      className={`flex items-center gap-2 w-full text-left px-1 -mx-1 py-0.5 rounded ${
                        active
                          ? 'bg-slate-100 ring-1 ring-slate-300'
                          : 'hover:bg-slate-50'
                      } ${dimmed ? 'opacity-40' : ''}`}
                      title={
                        active
                          ? 'Click to clear filter'
                          : `Click to show only tier ${tier}`
                      }
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm border border-slate-300 shrink-0"
                        style={{ background: TIER_COLOR[tier] }}
                      />
                      <span className="leading-tight">{TIER_LABEL[tier]}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {tierFilter !== 'all' && (
              <button
                type="button"
                onClick={() => onTierFilter('all')}
                className="text-[10px] text-indigo-600 hover:underline mt-1"
              >
                Clear filter
              </button>
            )}
            <div className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              Districts not yet researched default to tier 1, lighter shade.
            </div>
            {coverage && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Population coverage
                </div>
                {([4, 3, 2, 1] as const).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: TIER_COLOR[t as PhoneTier] }}
                    />
                    <span className="text-[11px] text-slate-700 tabular-nums">
                      {formatPct(coverage.byTier[t], coverage.totalPop)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      tier {t}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-slate-400">
                  {formatPct(coverage.unresearchedPop, coverage.totalPop)} of MA
                  population in {306 - coverage.researchedDistrictCount} unresearched districts.
                </div>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 leading-snug">
              <div className="font-medium text-slate-700">Statewide mandate</div>
              <div>S.2561: bell-to-bell in all MA public schools</div>
              <div className="text-slate-400">
                {MANDATE_DATE.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {mandate.label}
              </div>
            </div>
          </div>
        )}

        {showParents && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Parent presence
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                style={{ background: '#7c3aed' }}
              />
              <span>Town has a chapter on file</span>
            </div>
          </div>
        )}

        {showChapterPipeline && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Chapter pipeline
            </div>
            <ul className="space-y-0.5">
              {[0, 1, 2, 3, 4, 5].map((stage) => (
                <li key={stage} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 shrink-0 border border-white shadow-sm"
                    style={{
                      background: STAGE_COLOR[stage],
                      transform: 'rotate(45deg)',
                    }}
                  />
                  <span>
                    {stage} ·{' '}
                    {
                      ['Identified', 'Prospecting', 'Activated', 'Programming', 'Sustained', 'Network Hub'][
                        stage
                      ]
                    }
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              CIRL Chapter Pipeline Tracker. A chapter advances by meeting a
              gate, not by time passing. Diamond offset up-right of the
              parent-presence dot.
            </div>
          </div>
        )}

        {showAiPilot && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              AI pilot
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center rounded-sm text-white text-[9px] font-bold shrink-0"
                style={{ background: '#0d9488', width: 18, height: 12 }}
              >
                AI
              </span>
              <span>District in DESE/PLTW pilot</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Healey-Driscoll + Project Lead The Way AI curriculum pilot,
              announced Nov 2025. 30 districts, ~45 educators, ~1,600 students
              in SY2025-26.
            </div>
          </div>
        )}

        {showSize && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Size gradient
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 flex-1 rounded-sm border border-slate-300"
                style={{
                  background:
                    'linear-gradient(to right, rgba(100,116,139,0.15), rgba(100,116,139,0.85))',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>smaller</span>
              <span>larger</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              avg(area, enrollment); falls back to area only when enrollment unknown.
            </div>
          </div>
        )}

        {showCounties && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Counties (14)
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#475569"
                  strokeWidth="1.6"
                />
              </svg>
              <span>County boundary</span>
            </div>
          </div>
        )}

        {showCong && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              US House (9 districts)
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#7c3aed"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              </svg>
              <span>District boundary</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-4 h-4 rounded-full border border-purple-600 bg-white text-[10px] font-bold text-purple-700 flex items-center justify-center">
                #
              </span>
              <span>District number (outside MA)</span>
            </div>
          </div>
        )}

        {showSenate && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              MA Senate (40 districts)
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#dc2626"
                  strokeWidth="1.4"
                  strokeDasharray="6 3"
                />
              </svg>
              <span>District boundary</span>
            </div>
          </div>
        )}

        {showHouse && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              MA House (160 districts)
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#0ea5e9"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              </svg>
              <span>District boundary</span>
            </div>
          </div>
        )}

        {showSchool && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              School districts
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#ca8a04"
                  strokeWidth="1.2"
                  strokeDasharray="5 2 1 2"
                />
              </svg>
              <span>District boundary</span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">
          Click any town for details. Hover for the town name.
          <div className="mt-1">
            <a
              href={`${import.meta.env.BASE_URL}data/phone-policies.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Download phone-policies.json
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
