import { memo, useEffect, useState } from 'react'
import { loadLayer, type LayerName, type PhoneTier, type ProjectedLayer } from './geo'
import type { World } from './model'
import {
  AI_PILOT,
  BOUNDARY,
  POSTURE_COLOR,
  PRESENCE,
  PUSHBACK_COLOR,
  PUSHBACK_MARKER,
  TIER_COLOR,
} from './colors'

export type Lens = 'policy' | 'organizing' | 'edtech' | 'pushback'
export type BoundaryKey = 'counties' | 'school' | 'congressional' | 'stateSenate' | 'stateHouse'
export type TierFilter = 'all' | PhoneTier
export type PushbackFilter = 'all' | 0 | 1 | 2 | 3

const BOUNDARY_LAYER: Record<BoundaryKey, LayerName> = {
  counties: 'counties',
  school: 'schoolDistricts',
  congressional: 'congressional',
  stateSenate: 'stateSenate',
  stateHouse: 'stateHouse',
}

// memo'd on k (zoom) rather than the full camera: panning only moves the
// parent <g> transform, so the 351 town paths never re-render per frame.
export const MapLayers = memo(function MapLayers({
  world,
  k,
  lens,
  tierFilter,
  pushbackFilter,
  boundaries,
  selectedId,
  onSelect,
  onHover,
}: {
  world: World
  k: number
  lens: Lens
  tierFilter: TierFilter
  pushbackFilter: PushbackFilter
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

  const fillFor = (townId: string): { fill: string; alpha: number } => {
    const rec = world.records.get(townId)
    if (!rec) return { fill: 'var(--map-surface)', alpha: 1 }
    if (lens === 'policy') {
      const tier: PhoneTier = rec.policy?.tier ?? 1
      if (tierFilter !== 'all' && tier !== tierFilter) return { fill: '#d6d3ca', alpha: 0.35 }
      return { fill: TIER_COLOR[tier], alpha: tier === 1 ? 1 : 0.82 }
    }
    if (lens === 'pushback') {
      const n = Math.min(3, rec.edtechActions.filter((a) => a.kind === 'action').length) as 0 | 1 | 2 | 3
      if (pushbackFilter !== 'all' && n !== pushbackFilter) return { fill: '#d6d3ca', alpha: 0.35 }
      if (n === 0) return { fill: '#ffffff', alpha: 0.55 }
      return { fill: PUSHBACK_COLOR[n], alpha: 0.82 }
    }
    if (lens === 'edtech') {
      // Posture is classified once at world build; unresearched = base fill.
      if (rec.edtechPosture == null) return { fill: '#ffffff', alpha: 0.55 }
      return { fill: POSTURE_COLOR[rec.edtechPosture], alpha: 0.82 }
    }
    // organizing lens
    if (rec.orgs.length >= 2) return { fill: PRESENCE, alpha: 0.55 }
    if (rec.orgs.length === 1) return { fill: PRESENCE, alpha: 0.3 }
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

      {/* Presence dots (organizing lens). */}
      {lens === 'organizing' &&
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

      {/* AI-curriculum-pilot diamonds (edtech lens) — one per town in a
          pilot district, joined via NCES id like the phone-policy fills. */}
      {lens === 'edtech' &&
        world.towns
          .filter((f) => world.records.get(f.id)?.aiPilot)
          .map((f) => {
            const [cx, cy] = f.centroid
            const r = 4 / k
            return (
              <path
                key={`ai-${f.id}`}
                d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
                fill={AI_PILOT}
                stroke="#fff"
                strokeWidth={1.2 / k}
                pointerEvents="none"
              />
            )
          })}

      {/* Governance-body / official rings (pushback lens) — one per town
          with a standing body or a named official on record, distinct from
          the red action-intensity fill underneath it. */}
      {lens === 'pushback' &&
        world.towns
          .filter((f) => {
            const rec = world.records.get(f.id)
            return rec?.edtechActions.some((a) => a.kind === 'body' || a.kind === 'official')
          })
          .map((f) => {
            const [cx, cy] = f.centroid
            return (
              <circle
                key={`pushback-${f.id}`}
                cx={cx}
                cy={cy}
                r={4.5 / k}
                fill="none"
                stroke={PUSHBACK_MARKER}
                strokeWidth={1.6 / k}
                pointerEvents="none"
              />
            )
          })}
    </>
  )
})
