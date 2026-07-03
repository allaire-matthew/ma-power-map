import { useEffect, useState } from 'react'
import { loadLayer, type LayerName, type PhoneTier, type ProjectedLayer } from './geo'
import type { World } from './model'
import type { Camera } from './MapCanvas'
import { BOUNDARY, PRESENCE, STAGE_COLOR, TIER_COLOR } from './colors'

export type Lens = 'chapters' | 'policy' | 'organizing'
export type BoundaryKey = 'counties' | 'school' | 'congressional' | 'stateSenate' | 'stateHouse'
export type TierFilter = 'all' | PhoneTier

const BOUNDARY_LAYER: Record<BoundaryKey, LayerName> = {
  counties: 'counties',
  school: 'schoolDistricts',
  congressional: 'congressional',
  stateSenate: 'stateSenate',
  stateHouse: 'stateHouse',
}

export function MapLayers({
  world,
  camera,
  lens,
  tierFilter,
  boundaries,
  selectedId,
  onSelect,
  onHover,
}: {
  world: World
  camera: Camera
  lens: Lens
  tierFilter: TierFilter
  boundaries: Set<BoundaryKey>
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (h: { id: string; x: number; y: number } | null) => void
}) {
  const [outlines, setOutlines] = useState<Partial<Record<BoundaryKey, ProjectedLayer>>>({})

  useEffect(() => {
    let cancelled = false
    for (const key of boundaries) {
      if (outlines[key]) continue
      void loadLayer(BOUNDARY_LAYER[key]).then((l) => {
        if (!cancelled) setOutlines((prev) => ({ ...prev, [key]: l }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [boundaries, outlines])

  const k = camera.k

  const fillFor = (townId: string): { fill: string; alpha: number } => {
    const rec = world.records.get(townId)
    if (!rec) return { fill: 'var(--map-surface)', alpha: 1 }
    if (lens === 'policy') {
      const tier: PhoneTier = rec.policy?.tier ?? 1
      if (tierFilter !== 'all' && tier !== tierFilter) return { fill: '#d6d3ca', alpha: 0.35 }
      return { fill: TIER_COLOR[tier], alpha: tier === 1 ? 1 : 0.82 }
    }
    if (lens === 'organizing') {
      if (rec.orgs.length >= 2) return { fill: PRESENCE, alpha: 0.55 }
      if (rec.orgs.length === 1) return { fill: PRESENCE, alpha: 0.3 }
      return { fill: '#ffffff', alpha: 0.55 }
    }
    // chapters lens — the story is the pipeline; presence is context.
    if (rec.pipeline) return { fill: STAGE_COLOR[rec.pipeline.stage] ?? STAGE_COLOR[0], alpha: 0.85 }
    if (rec.orgs.length > 0) return { fill: PRESENCE, alpha: 0.22 }
    return { fill: '#ffffff', alpha: 0.55 }
  }

  return (
    <>
      {/* Town fills — the single land render; boundaries stack above. */}
      <g>
        {world.towns.map((f) => {
          const { fill, alpha } = fillFor(f.id)
          return (
            <path
              key={f.id}
              data-town={f.id}
              d={f.d}
              fill={fill}
              fillOpacity={alpha}
              stroke={BOUNDARY.town.stroke}
              strokeWidth={BOUNDARY.town.width / k}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(f.id)
              }}
              onPointerMove={(e) => onHover({ id: f.id, x: e.clientX, y: e.clientY })}
              onPointerLeave={() => onHover(null)}
            />
          )
        })}
      </g>

      {/* Selected town ring — navy, on top of fills. */}
      {selectedId &&
        (() => {
          const f = world.towns.find((t) => t.id === selectedId)
          if (!f) return null
          return (
            <path
              d={f.d}
              fill="none"
              stroke="var(--navy)"
              strokeWidth={2.6 / k}
              pointerEvents="none"
            />
          )
        })()}

      {/* Boundary outlines (recessive, dashed except counties). */}
      {[...boundaries].map((key) => {
        const layer = outlines[key]
        if (!layer) return null
        const s: { stroke: string; width: number; dash?: string } =
          BOUNDARY[key === 'counties' ? 'county' : key]
        return (
          <g key={key} pointerEvents="none">
            {layer.features.map((f) => (
              <path
                key={f.id}
                d={f.d}
                fill="none"
                stroke={s.stroke}
                strokeWidth={s.width / k}
                strokeDasharray={
                  s.dash
                    ? s.dash.split(' ').map((n) => Number(n) / k).join(' ')
                    : undefined
                }
                opacity={0.75}
              />
            ))}
          </g>
        )
      })}

      {/* Presence dots (chapters + organizing lenses). */}
      {lens !== 'policy' &&
        world.tracked
          .filter((r) => r.orgs.length > 0)
          .map((r) => {
            const f = world.towns.find((t) => t.id === r.id)
            if (!f) return null
            const [cx, cy] = f.centroid
            const n = r.orgs.length
            return (
              <g key={`dot-${r.id}`} pointerEvents="none">
                <circle
                  cx={cx}
                  cy={cy}
                  r={(n > 1 ? 4.5 : 3.5) / k}
                  fill={PRESENCE}
                  stroke="#fff"
                  strokeWidth={1.2 / k}
                />
                {n > 1 && (
                  <text
                    x={cx}
                    y={cy + 0.4 / k}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={6 / k}
                    fontWeight={600}
                    fill="#fff"
                  >
                    {n}
                  </text>
                )}
              </g>
            )
          })}

      {/* Chapter stage diamonds — pipeline towns, chapters lens. */}
      {lens === 'chapters' &&
        world.tracked
          .filter((r) => r.pipeline)
          .map((r) => {
            const f = world.towns.find((t) => t.id === r.id)
            if (!f) return null
            const [cx0, cy0] = f.centroid
            const cx = cx0 + 10 / k
            const cy = cy0 - 10 / k
            const s = 9 / k
            const color = STAGE_COLOR[r.pipeline!.stage] ?? STAGE_COLOR[0]
            return (
              <g key={`badge-${r.id}`} pointerEvents="none">
                <path
                  d={`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.4 / k}
                />
                <text
                  x={cx}
                  y={cy + 0.4 / k}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5 / k}
                  fontWeight={600}
                  fill="#fff"
                >
                  {r.pipeline!.stage}
                </text>
              </g>
            )
          })}
    </>
  )
}
