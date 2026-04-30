import { useEffect, useMemo, useRef, useState } from 'react'
import {
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
import { useIrlCouncils } from './irlCouncils'

const STYLES: Record<
  LayerName,
  { stroke: string; strokeWidth: number; dash?: string; label: string }
> = {
  counties: { stroke: '#475569', strokeWidth: 1.4, label: 'County' },
  towns: { stroke: '#cbd5e1', strokeWidth: 0.4, label: 'Town' },
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

const TIER_COLOR: Record<PhoneTier, string> = {
  1: '#ef4444', // red — no district policy
  2: '#eab308', // yellow — partial / non-hardware
  3: '#22c55e', // green — full hardware K-12
}

const TIER_LABEL: Record<PhoneTier, string> = {
  1: 'Tier 1 — No district policy',
  2: 'Tier 2 — Partial / non-hardware',
  3: 'Tier 3 — Hardware ban K-12',
}

export type Selection = {
  layer: LayerName
  geoid: string
  x: number
  y: number
}

export function MapBackground({
  camera,
  layers,
  inspect,
  selected,
  onSelect,
  onDismiss,
}: {
  camera: { x: number; y: number; z: number }
  layers: LayerState
  inspect: boolean
  selected: Selection | null
  onSelect: (s: Selection) => void
  onDismiss: () => void
}) {
  const [data, setData] = useState<Partial<Record<LayerName, ProjectedLayer>>>({})
  const [policies, setPolicies] = useState<Record<string, PhonePolicy>>({})
  const { marked, toggle: toggleIrl } = useIrlCouncils()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const groupRefs = useRef<Partial<Record<LayerName, SVGGElement | null>>>({})
  const [hover, setHover] = useState<{
    layer: LayerName
    name: string
    x: number
    y: number
  } | null>(null)

  // Decide which geo files we need based on the toggle state.
  const needed = useMemo<LayerName[]>(() => {
    const want = new Set<LayerName>(['towns'])
    if (
      layers.phoneFree ||
      layers.sizeGradient ||
      layers.schoolDistricts
    )
      want.add('schoolDistricts')
    if (layers.congressional) want.add('congressional')
    if (layers.stateLegislature) {
      want.add('stateHouse')
      want.add('stateSenate')
    }
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
    return () => {
      cancelled = true
    }
  }, [])

  // Per-district size score: average of normalized polygon area and
  // normalized enrollment (when available). Districts without enrollment
  // fall back to area-only so the gradient still ranks them.
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

  // Hover-name detection across the tldraw layer above us.
  // isPointInFill is pure geometry so it works regardless of pointer-events.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let raf = 0
    let pending: { x: number; y: number } | null = null
    // Hover priority: districts first (most informative), then districts of
    // government layers if present, then towns as fallback.
    const hoverOrder: LayerName[] = [
      'schoolDistricts',
      'congressional',
      'stateSenate',
      'stateHouse',
      'towns',
    ]
    const process = () => {
      raf = 0
      if (!pending) return
      const { x: cx, y: cy } = pending
      pending = null
      for (const layerName of hoverOrder) {
        const g = groupRefs.current[layerName]
        if (!g) continue
        const ctm = g.getScreenCTM()
        if (!ctm) continue
        const screenPt = svg.createSVGPoint()
        screenPt.x = cx
        screenPt.y = cy
        const localPt = screenPt.matrixTransform(ctm.inverse())
        const paths = g.querySelectorAll<SVGPathElement>('path[data-id]')
        for (const p of paths) {
          if (p.isPointInFill(localPt)) {
            const id = p.dataset.id!
            const feature = data[layerName]?.features.find((f) => f.id === id)
            if (feature) {
              setHover({ layer: layerName, name: feature.name, x: cx, y: cy })
              return
            }
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
  }, [data, layers, camera])

  const t = `translate(${camera.x * camera.z} ${camera.y * camera.z}) scale(${camera.z})`

  const selectedFeature: ProjectedFeature | null =
    (selected && data[selected.layer]?.features.find((f) => f.id === selected.geoid)) ??
    null

  const districts = data.schoolDistricts?.features ?? []
  const congressional = data.congressional?.features ?? []
  const stateHouse = data.stateHouse?.features ?? []
  const stateSenate = data.stateSenate?.features ?? []
  const towns = data.towns?.features ?? []

  const onPathClick = (k: LayerName, f: ProjectedFeature) =>
    inspect
      ? (ev: React.MouseEvent) => {
          ev.stopPropagation()
          onSelect({ layer: k, geoid: f.id, x: ev.clientX, y: ev.clientY })
        }
      : undefined

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{
          background: '#f8fafc',
          pointerEvents: inspect ? 'auto' : 'none',
        }}
        onClick={(e) => {
          if (inspect && e.target === e.currentTarget) onDismiss()
        }}
      >
        <g transform={t}>
          {/* Base towns layer — always on, very faint, just for context. */}
          <g
            ref={(el) => {
              groupRefs.current.towns = el
            }}
          >
            {towns.map((f) => (
              <path
                key={f.id}
                data-id={f.id}
                d={f.d}
                fill="#f8fafc"
                stroke={STYLES.towns.stroke}
                strokeWidth={STYLES.towns.strokeWidth / camera.z}
                style={{
                  cursor: inspect ? 'pointer' : undefined,
                  pointerEvents: inspect ? 'visiblePainted' : 'none',
                }}
                onClick={onPathClick('towns', f)}
              />
            ))}
          </g>

          {/* School districts — fill driven by phoneFree tier and/or size gradient. */}
          {(layers.phoneFree || layers.sizeGradient) && (
            <g
              ref={(el) => {
                groupRefs.current.schoolDistricts = el
              }}
            >
              {districts.map((f) => {
                const policy = policies[f.id]
                const tier: PhoneTier = policy?.tier ?? 1
                const fill = layers.phoneFree ? TIER_COLOR[tier] : '#64748b'
                const baseAlpha = layers.phoneFree
                  ? tier === 3
                    ? 0.55
                    : tier === 2
                      ? 0.45
                      : policy
                        ? 0.35
                        : 0.18
                  : 0.05
                const sizeMul = layers.sizeGradient
                  ? 0.25 + 0.9 * (sizeScore[f.id] ?? 0)
                  : 1
                const alpha = Math.min(0.85, baseAlpha * sizeMul)
                return (
                  <path
                    key={f.id}
                    data-id={f.id}
                    d={f.d}
                    fill={fill}
                    fillOpacity={alpha}
                    stroke="none"
                    style={{
                      cursor: inspect ? 'pointer' : undefined,
                      pointerEvents: inspect ? 'visiblePainted' : 'none',
                    }}
                    onClick={onPathClick('schoolDistricts', f)}
                  />
                )
              })}
            </g>
          )}

          {/* School district outlines — only when explicitly toggled on. */}
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
                pointerEvents="none"
              />
            ))}

          {/* State legislature — both house and senate together. */}
          {layers.stateLegislature && (
            <>
              <g
                ref={(el) => {
                  groupRefs.current.stateHouse = el
                }}
              >
                {stateHouse.map((f) => (
                  <path
                    key={f.id}
                    data-id={f.id}
                    d={f.d}
                    fill="transparent"
                    stroke={STYLES.stateHouse.stroke}
                    strokeWidth={STYLES.stateHouse.strokeWidth / camera.z}
                    strokeDasharray={STYLES.stateHouse.dash!
                      .split(' ')
                      .map((n) => Number(n) / camera.z)
                      .join(' ')}
                    style={{
                      cursor: inspect ? 'pointer' : undefined,
                      pointerEvents: inspect ? 'visiblePainted' : 'none',
                    }}
                    onClick={onPathClick('stateHouse', f)}
                  />
                ))}
              </g>
              <g
                ref={(el) => {
                  groupRefs.current.stateSenate = el
                }}
              >
                {stateSenate.map((f) => (
                  <path
                    key={f.id}
                    data-id={f.id}
                    d={f.d}
                    fill="transparent"
                    stroke={STYLES.stateSenate.stroke}
                    strokeWidth={STYLES.stateSenate.strokeWidth / camera.z}
                    strokeDasharray={STYLES.stateSenate.dash!
                      .split(' ')
                      .map((n) => Number(n) / camera.z)
                      .join(' ')}
                    style={{
                      cursor: inspect ? 'pointer' : undefined,
                      pointerEvents: inspect ? 'visiblePainted' : 'none',
                    }}
                    onClick={onPathClick('stateSenate', f)}
                  />
                ))}
              </g>
            </>
          )}

          {/* US House outlines. */}
          {layers.congressional && (
            <g
              ref={(el) => {
                groupRefs.current.congressional = el
              }}
            >
              {congressional.map((f) => (
                <path
                  key={f.id}
                  data-id={f.id}
                  d={f.d}
                  fill="rgba(124,58,237,0.04)"
                  stroke={STYLES.congressional.stroke}
                  strokeWidth={STYLES.congressional.strokeWidth / camera.z}
                  strokeDasharray={STYLES.congressional.dash!
                    .split(' ')
                    .map((n) => Number(n) / camera.z)
                    .join(' ')}
                  style={{
                    cursor: inspect ? 'pointer' : undefined,
                    pointerEvents: inspect ? 'visiblePainted' : 'none',
                  }}
                  onClick={onPathClick('congressional', f)}
                />
              ))}
            </g>
          )}

          {/* IRL Council per-town overlay. */}
          {layers.irlCouncil &&
            towns.map((f) =>
              marked[f.id] ? (
                <path
                  key={`irl-${f.id}`}
                  d={f.d}
                  fill="rgba(16, 185, 129, 0.45)"
                  stroke="#047857"
                  strokeWidth={1.2 / camera.z}
                  pointerEvents="none"
                />
              ) : null,
            )}

          {selected && selectedFeature && (
            <path
              d={selectedFeature.d}
              fill="rgba(99, 102, 241, 0.18)"
              stroke="#4f46e5"
              strokeWidth={1.8 / camera.z}
              pointerEvents="none"
            />
          )}

          {/* Congressional district number labels — placed outside the map
              boundary along a ray from the state center through each
              district's centroid. */}
          {layers.congressional && congressional.length > 0 && (
            <CongressionalLabels features={congressional} cameraZ={camera.z} />
          )}
        </g>
      </svg>

      {hover && !selected && (
        <div
          className="absolute z-30 pointer-events-none px-2 py-1 bg-slate-900 text-white text-xs rounded shadow whitespace-nowrap"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.name}
        </div>
      )}

      {selected && selectedFeature && (
        <FeatureCard
          layer={selected.layer}
          feature={selectedFeature}
          policy={
            selected.layer === 'schoolDistricts' ? policies[selectedFeature.id] : undefined
          }
          x={selected.x}
          y={selected.y}
          isCouncil={!!marked[selectedFeature.id]}
          onToggleCouncil={() => toggleIrl(selectedFeature.id)}
          onClose={onDismiss}
        />
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
      const lx = cx0 + dx * s
      const ly = cy0 + dy * s
      return { num, cx, cy, lx, ly }
    })
    .filter(Boolean) as { num: number; cx: number; cy: number; lx: number; ly: number }[]

  // Simple de-overlap: sort by angle, nudge same-quadrant labels apart along
  // the perimeter so urban (Boston-cluster) labels don't pile up.
  labels.sort((a, b) => Math.atan2(a.ly - cy0, a.lx - cx0) - Math.atan2(b.ly - cy0, b.lx - cx0))
  const minSep = 60
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1]
    const cur = labels[i]
    const d = Math.hypot(cur.lx - prev.lx, cur.ly - prev.ly)
    if (d < minSep) {
      // Nudge cur further along its outward ray
      const dx = cur.lx - cx0
      const dy = cur.ly - cy0
      const len = Math.hypot(dx, dy) || 1
      const push = (minSep - d) + 6
      cur.lx += (dx / len) * push
      cur.ly += (dy / len) * push
    }
  }

  return (
    <g pointerEvents="none">
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

function FeatureCard({
  layer,
  feature,
  policy,
  x,
  y,
  isCouncil,
  onToggleCouncil,
  onClose,
}: {
  layer: LayerName
  feature: ProjectedFeature
  policy: PhonePolicy | undefined
  x: number
  y: number
  isCouncil: boolean
  onToggleCouncil: () => void
  onClose: () => void
}) {
  const W = 280
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, x - W / 2))
  const top = Math.max(56, y + 12)
  return (
    <div
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute z-40 bg-white border border-slate-300 rounded shadow-md text-sm"
      style={{ left, top, width: W }}
    >
      <div className="flex items-start justify-between p-2 border-b border-slate-200">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {layer === 'schoolDistricts' && feature.kind
              ? `${feature.kind} school district`
              : STYLES[layer].label}
          </div>
          <div className="font-semibold text-slate-900 leading-tight">
            {feature.name}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 leading-none px-1 -mt-0.5"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="p-2 space-y-2">
        {layer === 'towns' && (
          <>
            <div className="text-slate-700">
              Population:{' '}
              <span className="font-medium tabular-nums">
                {feature.population != null
                  ? feature.population.toLocaleString()
                  : '—'}
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCouncil}
                onChange={onToggleCouncil}
                className="accent-emerald-600"
              />
              <span className={isCouncil ? 'text-emerald-800 font-medium' : ''}>
                IRL Council
              </span>
            </label>
          </>
        )}

        {layer === 'schoolDistricts' && (
          <PhonePolicyBlock policy={policy} />
        )}
      </div>
    </div>
  )
}

function PhonePolicyBlock({ policy }: { policy: PhonePolicy | undefined }) {
  const tier: PhoneTier = policy?.tier ?? 1
  return (
    <div className="space-y-1.5">
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
          <div className="text-slate-700 text-[13px] leading-snug">
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
          No policy on file. Defaults to tier 1 until researched. See
          RESEARCH_SPEC_PHONE_POLICIES.md.
        </div>
      )}
    </div>
  )
}
