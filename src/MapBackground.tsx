import { useEffect, useRef, useState } from 'react'
import {
  loadLayer,
  type LayerName,
  type ProjectedFeature,
  type ProjectedLayer,
} from './geo'
import type { LayerState } from './LayerToggles'
import { useIrlCouncils } from './irlCouncils'

const STYLES: Record<
  LayerName,
  { stroke: string; fill: string; strokeWidth: number; dash?: string; label: string }
> = {
  counties: {
    stroke: '#475569',
    fill: 'transparent',
    strokeWidth: 1.4,
    label: 'County',
  },
  towns: {
    stroke: '#94a3b8',
    fill: '#f1f5f9',
    strokeWidth: 0.5,
    label: 'Town',
  },
  congressional: {
    stroke: '#7c3aed',
    fill: 'rgba(124,58,237,0.04)',
    strokeWidth: 1.2,
    dash: '4 3',
    label: 'US House district',
  },
  stateHouse: {
    stroke: '#0ea5e9',
    fill: 'transparent',
    strokeWidth: 0.7,
    dash: '2 2',
    label: 'MA House district',
  },
  stateSenate: {
    stroke: '#dc2626',
    fill: 'transparent',
    strokeWidth: 1.0,
    dash: '6 3',
    label: 'MA Senate district',
  },
  schoolDistricts: {
    stroke: '#ca8a04',
    fill: 'rgba(202,138,4,0.05)',
    strokeWidth: 0.9,
    dash: '5 2 1 2',
    label: 'School district',
  },
}

// Render order = z-order. Towns first (bottom, solid fill); outline layers on
// top so they remain visible. Click order follows: town body clicks land on
// the town; clicks on a district stroke land on the district.
const ORDER: LayerName[] = [
  'towns',
  'counties',
  'schoolDistricts',
  'congressional',
  'stateHouse',
  'stateSenate',
]

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
  const { marked, toggle: toggleIrl } = useIrlCouncils()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const groupRefs = useRef<Partial<Record<LayerName, SVGGElement | null>>>({})
  const [hover, setHover] = useState<{
    layer: LayerName
    name: string
    x: number
    y: number
  } | null>(null)

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
      // Iterate layers from topmost-rendered to bottom so the most specific
      // outline wins when several overlap. isPointInFill is a geometry
      // method — it works regardless of pointer-events / stacking, which is
      // why we can hover-detect through the tldraw layer above us.
      for (let i = ORDER.length - 1; i >= 0; i--) {
        const layerName = ORDER[i]
        if (!layerEnabled(layerName, layers)) continue
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

  useEffect(() => {
    const wanted = ORDER.filter((k) => layerEnabled(k, layers))
    let cancelled = false
    Promise.all(
      wanted.map(async (k) => [k, await loadLayer(k)] as const),
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
  }, [layers])

  const t = `translate(${camera.x * camera.z} ${camera.y * camera.z}) scale(${camera.z})`

  const selectedFeature: ProjectedFeature | null =
    (selected && data[selected.layer]?.features.find((f) => f.id === selected.geoid)) ??
    null

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
          {ORDER.map((k) => {
            if (!layerEnabled(k, layers)) return null
            const layer = data[k]
            if (!layer) return null
            const s = STYLES[k]
            return (
              <g
                key={k}
                ref={(el) => {
                  groupRefs.current[k] = el
                }}
              >
                {layer.features.map((f) => (
                  <path
                    key={f.id}
                    data-id={f.id}
                    d={f.d}
                    fill={s.fill}
                    stroke={s.stroke}
                    strokeWidth={s.strokeWidth / camera.z}
                    strokeDasharray={
                      s.dash
                        ? s.dash
                            .split(' ')
                            .map((n) => Number(n) / camera.z)
                            .join(' ')
                        : undefined
                    }
                    style={{
                      cursor: inspect ? 'pointer' : undefined,
                      pointerEvents: inspect ? 'visiblePainted' : 'none',
                    }}
                    onClick={
                      inspect
                        ? (ev) => {
                            ev.stopPropagation()
                            onSelect({
                              layer: k,
                              geoid: f.id,
                              x: ev.clientX,
                              y: ev.clientY,
                            })
                          }
                        : undefined
                    }
                  />
                ))}
              </g>
            )
          })}

          {layers.irlCouncil &&
            data.towns?.features.map((f) =>
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

function FeatureCard({
  layer,
  feature,
  x,
  y,
  isCouncil,
  onToggleCouncil,
  onClose,
}: {
  layer: LayerName
  feature: ProjectedFeature
  x: number
  y: number
  isCouncil: boolean
  onToggleCouncil: () => void
  onClose: () => void
}) {
  const W = 240
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
      </div>
    </div>
  )
}

function layerEnabled(k: LayerName, l: LayerState): boolean {
  switch (k) {
    case 'counties':
      return l.counties
    case 'towns':
      return l.towns
    case 'congressional':
      return l.congressional
    case 'stateHouse':
      return l.stateHouse
    case 'stateSenate':
      return l.stateSenate
    case 'schoolDistricts':
      return l.schoolDistricts
  }
}
