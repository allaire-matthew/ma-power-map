import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getTownToDistrict,
  loadDemographics,
  loadLayer,
  loadPhonePolicies,
  loadTownOrgs,
  MAP_H,
  MAP_W,
  type DistrictDemographics,
  type LayerName,
  type PhonePolicy,
  type PhoneTier,
  type ProjectedFeature,
  type ProjectedLayer,
  type TownOrgChapter,
} from './geo'
import type { LayerState } from './LayerToggles'
import type { TierFilter } from './App'

const STYLES: Record<
  LayerName,
  { stroke: string; strokeWidth: number; dash?: string; label: string }
> = {
  counties: { stroke: '#475569', strokeWidth: 1.4, label: 'County' },
  // Town strokes are the structural skeleton of the map. Need to be visible
  // against the semi-transparent district fills, especially around Cape Cod
  // and the islands where small polygons otherwise blob together.
  towns: { stroke: '#94a3b8', strokeWidth: 0.55, label: 'Town' },
  congressional: {
    stroke: '#7c3aed',
    strokeWidth: 1.2,
    dash: '4 3',
    label: 'US House district',
  },
  stateHouse: {
    stroke: '#0ea5e9',
    strokeWidth: 0.7,
    dash: '2 2',
    label: 'MA House district',
  },
  stateSenate: {
    stroke: '#dc2626',
    strokeWidth: 1.0,
    dash: '6 3',
    label: 'MA Senate district',
  },
  schoolDistricts: {
    stroke: '#ca8a04',
    strokeWidth: 0.9,
    dash: '5 2 1 2',
    label: 'School district',
  },
}

export const TIER_COLOR: Record<PhoneTier, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
}

export const TIER_LABEL: Record<PhoneTier, string> = {
  1: 'Tier 1 — No district policy',
  2: 'Tier 2 — Partial / accessible storage',
  3: 'Tier 3 — Inaccessible storage but scope-limited',
  4: 'Tier 4 — Bell-to-bell, inaccessible storage, K-12',
}

export function MapBackground({
  camera,
  layers,
  popupTownId,
  onTownClick,
  onShiftTownClick,
  tierFilter,
  selectedTowns,
}: {
  camera: { x: number; y: number; z: number }
  layers: LayerState
  popupTownId: string | null
  onTownClick: (townId: string | null) => void
  onShiftTownClick?: (townId: string) => void
  tierFilter: TierFilter
  selectedTowns?: Set<string>
}) {
  const [data, setData] = useState<Partial<Record<LayerName, ProjectedLayer>>>({})
  const [policies, setPolicies] = useState<Record<string, PhonePolicy>>({})
  const [townToDistrict, setTownToDistrict] = useState<Record<string, string>>({})
  const [townOrgs, setTownOrgs] = useState<Record<string, TownOrgChapter[]>>({})
  const [demographics, setDemographics] = useState<Record<string, DistrictDemographics>>({})
  const svgRef = useRef<SVGSVGElement | null>(null)
  const groupRefs = useRef<Partial<Record<LayerName, SVGGElement | null>>>({})
  const [hover, setHover] = useState<{ townId: string; name: string; x: number; y: number } | null>(null)
  const [dwellTownId, setDwellTownId] = useState<string | null>(null)
  const dwellTimer = useRef<number | null>(null)

  const needed = useMemo<LayerName[]>(() => {
    const want = new Set<LayerName>(['towns'])
    if (layers.counties) want.add('counties')
    if (layers.congressional) want.add('congressional')
    if (layers.stateHouse) want.add('stateHouse')
    if (layers.stateSenate) want.add('stateSenate')
    // Always load schoolDistricts so the click→district lookup works
    // for the popup, even when the visual layer is off.
    want.add('schoolDistricts')
    return Array.from(want)
  }, [layers])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      needed.map(async (k) => [k, await loadLayer(k)] as const),
    ).then((entries) => {
      if (cancelled) return
      setData((prev) => {
        const next = { ...prev }
        for (const [k, v] of entries) next[k] = v
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [needed])

  useEffect(() => {
    let cancelled = false
    void loadDemographics().then((d) => {
      if (!cancelled && d) setDemographics(d.demographics)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadPhonePolicies().then((p) => {
      if (!cancelled) setPolicies(p)
    })
    void getTownToDistrict().then((m) => {
      if (!cancelled) setTownToDistrict(m)
    })
    void loadTownOrgs().then((d) => {
      if (!cancelled && d) setTownOrgs(d.byTown ?? {})
    })
    return () => {
      cancelled = true
    }
  }, [])

  const sizeScore = useMemo<Record<string, number>>(() => {
    const districts = data.schoolDistricts?.features ?? []
    if (!districts.length) return {}
    const areas = districts.map((f) => f.area)
    const aMin = Math.min(...areas)
    const aMax = Math.max(...areas)
    const aRange = Math.max(1, aMax - aMin)
    const enrollments = districts
      .map((f) => policies[f.id]?.enrollment)
      .filter((v): v is number => typeof v === 'number')
    const eMin = enrollments.length ? Math.min(...enrollments) : 0
    const eMax = enrollments.length ? Math.max(...enrollments) : 1
    const eRange = Math.max(1, eMax - eMin)
    const out: Record<string, number> = {}
    for (const f of districts) {
      const aN = (f.area - aMin) / aRange
      const enr = policies[f.id]?.enrollment
      const eN = typeof enr === 'number' ? (enr - eMin) / eRange : null
      out[f.id] = eN == null ? aN : (aN + eN) / 2
    }
    return out
  }, [data.schoolDistricts, policies])

  // Hover ALWAYS resolves to the town under the cursor — districts and
  // legislative outlines never fight the tooltip for hits.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let raf = 0
    let pending: { x: number; y: number } | null = null
    const process = () => {
      raf = 0
      if (!pending) return
      const { x: cx, y: cy } = pending
      pending = null
      const g = groupRefs.current.towns
      if (!g) {
        setHover(null)
        return
      }
      const ctm = g.getScreenCTM()
      if (!ctm) {
        setHover(null)
        return
      }
      const screenPt = svg.createSVGPoint()
      screenPt.x = cx
      screenPt.y = cy
      const localPt = screenPt.matrixTransform(ctm.inverse())
      const paths = g.querySelectorAll<SVGPathElement>('path[data-id]')
      for (const p of paths) {
        if (p.isPointInFill(localPt)) {
          const id = p.dataset.id!
          const feature = data.towns?.features.find((f) => f.id === id)
          if (feature) {
            setHover((prev) => {
              // If we're still hovering the same town, keep the existing
              // dwell timer running. Just update position.
              if (prev && prev.townId === id) return { townId: id, name: feature.name, x: cx, y: cy }
              // New town — reset dwell.
              if (dwellTimer.current) window.clearTimeout(dwellTimer.current)
              setDwellTownId(null)
              dwellTimer.current = window.setTimeout(() => {
                setDwellTownId(id)
              }, 2000)
              return { townId: id, name: feature.name, x: cx, y: cy }
            })
            return
          }
        }
      }
      // No town under cursor — clear hover + dwell.
      if (dwellTimer.current) {
        window.clearTimeout(dwellTimer.current)
        dwellTimer.current = null
      }
      setDwellTownId(null)
      setHover(null)
    }
    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY }
      if (!raf) raf = requestAnimationFrame(process)
    }
    const onLeave = () => {
      if (dwellTimer.current) {
        window.clearTimeout(dwellTimer.current)
        dwellTimer.current = null
      }
      setDwellTownId(null)
      setHover(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [data.towns])

  // Click → town resolution. We listen on window in capture phase so we
  // see clicks before tldraw can stop propagation. Hits use the same
  // isPointInFill trick as hover; misses leave the popup state alone.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onClick = (e: MouseEvent) => {
      const g = groupRefs.current.towns
      if (!g) return
      const ctm = g.getScreenCTM()
      if (!ctm) return
      const screenPt = svg.createSVGPoint()
      screenPt.x = e.clientX
      screenPt.y = e.clientY
      const localPt = screenPt.matrixTransform(ctm.inverse())
      const paths = g.querySelectorAll<SVGPathElement>('path[data-id]')
      for (const p of paths) {
        if (p.isPointInFill(localPt)) {
          const id = p.dataset.id!
          // Ignore clicks on UI chrome (popup, legend, header, etc.).
          // Guard against synthetic events whose target isn't an Element
          // (e.g. window-dispatched MouseEvents used by debug/verify rigs).
          const target = e.target as { closest?: (s: string) => Element | null } | null
          if (typeof target?.closest === 'function' && target.closest('[data-map-ui]'))
            return
          // Shift+click always toggles selection (regardless of the
          // select-mode toggle in the header), so power users can
          // pick a few towns without switching tools.
          if (e.shiftKey && onShiftTownClick) {
            onShiftTownClick(id)
            e.preventDefault()
            e.stopPropagation()
            return
          }
          onTownClick(id)
          return
        }
      }
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [data.towns, onTownClick, onShiftTownClick])

  const t = `translate(${camera.x * camera.z} ${camera.y * camera.z}) scale(${camera.z})`

  const districts = data.schoolDistricts?.features ?? []
  const congressional = data.congressional?.features ?? []
  const stateHouse = data.stateHouse?.features ?? []
  const stateSenate = data.stateSenate?.features ?? []
  const counties = data.counties?.features ?? []
  const towns = data.towns?.features ?? []

  const popupTown = popupTownId
    ? towns.find((f) => f.id === popupTownId) ?? null
    : null

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: '#f8fafc', pointerEvents: 'none' }}
      >
        <g transform={t}>
          {/* Towns are the only land render — fill is driven by the
              containing school district's phone-free tier (and modulated
              by size gradient when on). This keeps the visible land mass
              tight to actual coastlines and avoids the "puffy ocean"
              effect of rendering coarse school-district polygons. */}
          <g
            ref={(el) => {
              groupRefs.current.towns = el
            }}
          >
            {towns.map((f) => {
              const dId = townToDistrict[f.id]
              const policy = dId ? policies[dId] : undefined
              const tier: PhoneTier = policy?.tier ?? 1
              const score = dId ? sizeScore[dId] ?? 0 : 0
              let fill = '#f8fafc'
              let alpha = 1
              const filteredOut =
                layers.phoneFree && tierFilter !== 'all' && tier !== tierFilter
              if (filteredOut) {
                fill = '#cbd5e1'
                alpha = 0.18
              } else if (layers.phoneFree && layers.sizeGradient) {
                // Tier color, modulated by district size for clearly
                // visible gradient between small/large districts.
                fill = TIER_COLOR[tier]
                const baseAlpha =
                  tier === 4 ? 0.65
                    : tier === 3 ? 0.55
                    : tier === 2 ? 0.5
                    : policy ? 0.4 : 0.25
                alpha = Math.min(0.9, baseAlpha * (0.45 + 0.85 * score))
              } else if (layers.phoneFree) {
                fill = TIER_COLOR[tier]
                alpha =
                  tier === 4 ? 0.6
                    : tier === 3 ? 0.5
                    : tier === 2 ? 0.45
                    : policy ? 0.35 : 0.2
              } else if (layers.sizeGradient) {
                // Standalone gray ramp — must be plainly visible.
                fill = '#334155'
                alpha = 0.12 + 0.7 * score
              }
              return (
                <path
                  key={f.id}
                  data-id={f.id}
                  d={f.d}
                  fill={fill}
                  fillOpacity={alpha}
                  stroke={STYLES.towns.stroke}
                  strokeWidth={STYLES.towns.strokeWidth / camera.z}
                />
              )
            })}
          </g>

          {/* Selected-town outlines (multi-select tool). Indigo ring on top of
              everything else — bright enough to read at any zoom. */}
          {selectedTowns && selectedTowns.size > 0 && (
            <g pointerEvents="none">
              {towns
                .filter((f) => selectedTowns.has(f.id))
                .map((f) => (
                  <path
                    key={`sel-${f.id}`}
                    d={f.d}
                    fill="rgba(79, 70, 229, 0.12)"
                    stroke="#4f46e5"
                    strokeWidth={2.4 / camera.z}
                  />
                ))}
            </g>
          )}

          {/* Explicit school-district outlines (toggle on top of fills). */}
          {layers.schoolDistricts &&
            districts.map((f) => (
              <path
                key={`sd-out-${f.id}`}
                d={f.d}
                fill="none"
                stroke={STYLES.schoolDistricts.stroke}
                strokeWidth={STYLES.schoolDistricts.strokeWidth / camera.z}
                strokeDasharray={STYLES.schoolDistricts.dash!
                  .split(' ')
                  .map((n) => Number(n) / camera.z)
                  .join(' ')}
              />
            ))}

          {/* Parent-presence dots. Each town with a chapter in
              town-orgs.json gets a small purple dot at its centroid. */}
          {layers.parentPresence &&
            towns.map((f) => {
              const key = (f.name || '').trim().toLowerCase()
              const chapters = townOrgs[key]
              if (!chapters || chapters.length === 0) return null
              const [cx, cy] = f.centroid
              const count = chapters.length
              return (
                <g key={`org-${f.id}`} pointerEvents="none">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(count > 1 ? 4.5 : 3.5) / camera.z}
                    fill="#7c3aed"
                    stroke="white"
                    strokeWidth={1.0 / camera.z}
                  />
                  {count > 1 && (
                    <text
                      x={cx}
                      y={cy + 1 / camera.z}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={6 / camera.z}
                      fontWeight={700}
                      fill="white"
                      style={{ fontFamily: 'system-ui, sans-serif' }}
                    >
                      {count}
                    </text>
                  )}
                </g>
              )
            })}

          {/* Tier-4 callouts. Bell-to-bell K-12 hardware bans are rare;
              they get a labeled badge on top of the green fill. */}
          {layers.phoneFree &&
            districts.map((f) => {
              const policy = policies[f.id]
              if (policy?.tier !== 4) return null
              const [cx, cy] = f.centroid
              return (
                <g key={`tier4-${f.id}`} pointerEvents="none">
                  <text
                    x={cx}
                    y={cy + 14 / camera.z}
                    textAnchor="middle"
                    fontSize={11 / camera.z}
                    fontWeight={600}
                    fill="#14532d"
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                      paintOrder: 'stroke',
                      stroke: 'white',
                      strokeWidth: 3 / camera.z,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {f.name.replace(/ School District$/, '')}
                  </text>
                </g>
              )
            })}

          {/* Counties — coarsest political subunit, solid outline. */}
          {layers.counties &&
            counties.map((f) => (
              <path
                key={`co-${f.id}`}
                d={f.d}
                fill="transparent"
                stroke={STYLES.counties.stroke}
                strokeWidth={STYLES.counties.strokeWidth / camera.z}
              />
            ))}

          {/* MA House (160 districts) — fine dashed outline. */}
          {layers.stateHouse &&
            stateHouse.map((f) => (
              <path
                key={`sh-${f.id}`}
                d={f.d}
                fill="transparent"
                stroke={STYLES.stateHouse.stroke}
                strokeWidth={STYLES.stateHouse.strokeWidth / camera.z}
                strokeDasharray={STYLES.stateHouse.dash!
                  .split(' ')
                  .map((n) => Number(n) / camera.z)
                  .join(' ')}
              />
            ))}

          {/* MA Senate (40 districts) — heavier dashed outline. */}
          {layers.stateSenate &&
            stateSenate.map((f) => (
              <path
                key={`ss-${f.id}`}
                d={f.d}
                fill="transparent"
                stroke={STYLES.stateSenate.stroke}
                strokeWidth={STYLES.stateSenate.strokeWidth / camera.z}
                strokeDasharray={STYLES.stateSenate.dash!
                  .split(' ')
                  .map((n) => Number(n) / camera.z)
                  .join(' ')}
              />
            ))}

          {/* US House outlines + outside-the-border number labels. */}
          {layers.congressional &&
            congressional.map((f) => (
              <path
                key={`cd-${f.id}`}
                d={f.d}
                fill="rgba(124,58,237,0.04)"
                stroke={STYLES.congressional.stroke}
                strokeWidth={STYLES.congressional.strokeWidth / camera.z}
                strokeDasharray={STYLES.congressional.dash!
                  .split(' ')
                  .map((n) => Number(n) / camera.z)
                  .join(' ')}
              />
            ))}
          {layers.congressional && congressional.length > 0 && (
            <CongressionalLabels features={congressional} cameraZ={camera.z} />
          )}

          {/* Popup town highlight. */}
          {popupTown && (
            <path
              d={popupTown.d}
              fill="rgba(99, 102, 241, 0.18)"
              stroke="#4f46e5"
              strokeWidth={1.8 / camera.z}
            />
          )}
        </g>
      </svg>

      {hover && dwellTownId !== hover.townId && (
        <div
          data-map-ui
          className="absolute z-30 pointer-events-none px-2 py-1 bg-slate-900 text-white text-xs rounded shadow whitespace-nowrap"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.name}
        </div>
      )}
      {hover && dwellTownId === hover.townId && (() => {
        const town = towns.find((f) => f.id === dwellTownId)
        const dId = townToDistrict[dwellTownId]
        const policy = dId ? policies[dId] : undefined
        const demo = dId ? demographics[dId] : undefined
        if (!town) return null
        return (
          <DwellTooltip
            x={hover.x}
            y={hover.y}
            townName={town.name}
            townPopulation={town.population ?? null}
            districtName={dId ? districts.find((d) => d.id === dId)?.name ?? null : null}
            policy={policy ?? null}
            demographics={demo ?? null}
          />
        )
      })()}
    </>
  )
}

function DwellTooltip({
  x,
  y,
  townName,
  townPopulation,
  districtName,
  policy,
  demographics,
}: {
  x: number
  y: number
  townName: string
  townPopulation: number | null
  districtName: string | null
  policy: PhonePolicy | null
  demographics: DistrictDemographics | null
}) {
  const tier: PhoneTier = policy?.tier ?? 1
  // Anchor near cursor but flip across the cursor when within ~280px of viewport edge.
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const W = 260
  const left = x + 14 + W > viewportW ? Math.max(8, x - 14 - W) : x + 14
  const top = y + 14 + 240 > viewportH ? Math.max(8, y - 14 - 240) : y + 14
  const fmtPct = (n: number | null | undefined) =>
    n == null ? '—' : `${n.toFixed(1)}%`
  return (
    <div
      data-map-ui
      className="absolute z-30 pointer-events-none px-3 py-2 bg-white border border-slate-200 rounded-md shadow-xl text-[11.5px] text-slate-700"
      style={{ left, top, width: W }}
    >
      <div className="font-semibold text-slate-900 text-[13px] leading-tight">
        {townName}
      </div>
      <div className="text-[10.5px] text-slate-500 mt-0.5">
        {districtName ?? 'No district resolved'}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: TIER_COLOR[tier] }}
        />
        <span className="text-[11px]">{TIER_LABEL[tier]}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 text-[10.5px]">
        <div className="text-slate-500">Town pop.</div>
        <div className="text-slate-800 tabular-nums text-right">
          {townPopulation != null ? townPopulation.toLocaleString() : '—'}
        </div>
        <div className="text-slate-500">Enrollment</div>
        <div className="text-slate-800 tabular-nums text-right">
          {demographics?.enrollment != null
            ? demographics.enrollment.toLocaleString()
            : policy?.enrollment != null
              ? policy.enrollment.toLocaleString()
              : '—'}
        </div>
        {demographics?.lowIncome != null && (
          <>
            <div className="text-slate-500">Low-income</div>
            <div className="text-slate-800 tabular-nums text-right">
              {fmtPct(demographics.lowIncome)}
            </div>
          </>
        )}
        {demographics?.ell != null && (
          <>
            <div className="text-slate-500">English learner</div>
            <div className="text-slate-800 tabular-nums text-right">
              {fmtPct(demographics.ell)}
            </div>
          </>
        )}
        {demographics?.swd != null && (
          <>
            <div className="text-slate-500">Students w/ disab.</div>
            <div className="text-slate-800 tabular-nums text-right">
              {fmtPct(demographics.swd)}
            </div>
          </>
        )}
        {demographics?.perPupilSpending != null && (
          <>
            <div className="text-slate-500">Per-pupil $</div>
            <div className="text-slate-800 tabular-nums text-right">
              ${demographics.perPupilSpending.toLocaleString()}
            </div>
          </>
        )}
      </div>
      {demographics?.raceEthnicity && (
        <div className="mt-2 pt-1.5 border-t border-slate-100">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Race / ethnicity
          </div>
          <div className="space-y-0.5 text-[10.5px]">
            {(['white', 'hispanic', 'black', 'asian', 'multiracial', 'native', 'pacific', 'other'] as const).map((k) => {
              const v = demographics.raceEthnicity?.[k]
              if (v == null) return null
              return (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-slate-600 capitalize">{k}</span>
                  <span className="text-slate-800 tabular-nums">{fmtPct(v)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {demographics?.year && (
        <div className="text-[9.5px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
          Data year: {demographics.year}
          {demographics.source && (
            <span className="ml-1.5 text-slate-300">· {new URL(demographics.source).hostname}</span>
          )}
        </div>
      )}
      {!demographics && (
        <div className="text-[10px] text-slate-400 italic mt-1.5 pt-1 border-t border-slate-100">
          Demographics not yet loaded for this district.
        </div>
      )}
    </div>
  )
}

function CongressionalLabels({
  features,
  cameraZ,
}: {
  features: ProjectedFeature[]
  cameraZ: number
}) {
  const cx0 = MAP_W / 2
  const cy0 = MAP_H / 2
  const margin = 90
  const labels = features
    .map((f) => {
      const m = f.name.match(/(\d+)/)
      if (!m) return null
      const num = parseInt(m[1], 10)
      const [cx, cy] = f.centroid
      const dx = cx - cx0
      const dy = cy - cy0
      const sx = dx === 0 ? Infinity : (MAP_W / 2 + margin) / Math.abs(dx)
      const sy = dy === 0 ? Infinity : (MAP_H / 2 + margin) / Math.abs(dy)
      const s = Math.min(sx, sy)
      return { num, cx, cy, lx: cx0 + dx * s, ly: cy0 + dy * s }
    })
    .filter(Boolean) as { num: number; cx: number; cy: number; lx: number; ly: number }[]

  labels.sort(
    (a, b) => Math.atan2(a.ly - cy0, a.lx - cx0) - Math.atan2(b.ly - cy0, b.lx - cx0),
  )
  const minSep = 60
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1]
    const cur = labels[i]
    const d = Math.hypot(cur.lx - prev.lx, cur.ly - prev.ly)
    if (d < minSep) {
      const dx = cur.lx - cx0
      const dy = cur.ly - cy0
      const len = Math.hypot(dx, dy) || 1
      const push = (minSep - d) + 6
      cur.lx += (dx / len) * push
      cur.ly += (dy / len) * push
    }
  }

  return (
    <g>
      {labels.map((l) => (
        <g key={l.num}>
          <line
            x1={l.cx}
            y1={l.cy}
            x2={l.lx}
            y2={l.ly}
            stroke="#7c3aed"
            strokeWidth={0.6 / cameraZ}
            strokeDasharray={`${2 / cameraZ} ${2 / cameraZ}`}
            opacity={0.5}
          />
          <circle
            cx={l.lx}
            cy={l.ly}
            r={14 / cameraZ}
            fill="white"
            stroke="#7c3aed"
            strokeWidth={1.4 / cameraZ}
          />
          <text
            x={l.lx}
            y={l.ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={16 / cameraZ}
            fontWeight={700}
            fill="#7c3aed"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {l.num}
          </text>
        </g>
      ))}
    </g>
  )
}
