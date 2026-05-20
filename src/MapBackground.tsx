import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getTownToDistrict,
  loadLayer,
  loadPhonePolicies,
  MAP_H,
  MAP_W,
  type LayerName,
  type PhonePolicy,
  type PhoneTier,
  type ProjectedFeature,
  type ProjectedLayer,
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
  2: '#eab308',
  3: '#22c55e',
}

export const TIER_LABEL: Record<PhoneTier, string> = {
  1: 'Tier 1 — No district policy',
  2: 'Tier 2 — Partial / non-hardware',
  3: 'Tier 3 — Hardware ban K-12',
}

export function MapBackground({
  camera,
  layers,
  popupTownId,
  onTownClick,
  tierFilter,
}: {
  camera: { x: number; y: number; z: number }
  layers: LayerState
  popupTownId: string | null
  onTownClick: (townId: string | null) => void
  tierFilter: TierFilter
}) {
  const [data, setData] = useState<Partial<Record<LayerName, ProjectedLayer>>>({})
  const [policies, setPolicies] = useState<Record<string, PhonePolicy>>({})
  const [townToDistrict, setTownToDistrict] = useState<Record<string, string>>({})
  const svgRef = useRef<SVGSVGElement | null>(null)
  const groupRefs = useRef<Partial<Record<LayerName, SVGGElement | null>>>({})
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)

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
    void loadPhonePolicies().then((p) => {
      if (!cancelled) setPolicies(p)
    })
    void getTownToDistrict().then((m) => {
      if (!cancelled) setTownToDistrict(m)
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
            setHover({ name: feature.name, x: cx, y: cy })
            return
          }
        }
      }
      setHover(null)
    }
    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY }
      if (!raf) raf = requestAnimationFrame(process)
    }
    const onLeave = () => setHover(null)
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
          onTownClick(id)
          return
        }
      }
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [data.towns, onTownClick])

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
                  tier === 3 ? 0.6 : tier === 2 ? 0.5 : policy ? 0.4 : 0.25
                alpha = Math.min(0.9, baseAlpha * (0.45 + 0.85 * score))
              } else if (layers.phoneFree) {
                fill = TIER_COLOR[tier]
                alpha =
                  tier === 3 ? 0.55 : tier === 2 ? 0.45 : policy ? 0.35 : 0.2
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

          {/* Tier-3 callouts. Hardware bans are rare enough that they
              deserve a visible badge — easier to spot than scanning the
              fill colors. */}
          {layers.phoneFree &&
            districts.map((f) => {
              const policy = policies[f.id]
              if (policy?.tier !== 3) return null
              const [cx, cy] = f.centroid
              return (
                <g key={`tier3-${f.id}`} pointerEvents="none">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6 / camera.z}
                    fill="#22c55e"
                    stroke="#15803d"
                    strokeWidth={1.4 / camera.z}
                  />
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

      {hover && (
        <div
          data-map-ui
          className="absolute z-30 pointer-events-none px-2 py-1 bg-slate-900 text-white text-xs rounded shadow whitespace-nowrap"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.name}
        </div>
      )}
    </>
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
