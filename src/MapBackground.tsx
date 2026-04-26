import { useEffect, useState } from 'react'
import {
  loadLayer,
  MAP_W,
  MAP_H,
  type LayerName,
  type ProjectedLayer,
} from './geo'
import type { LayerState } from './LayerToggles'
import { useIrlCouncils } from './irlCouncils'

const STYLES: Record<
  LayerName,
  { stroke: string; fill: string; strokeWidth: number; dash?: string }
> = {
  counties: { stroke: '#475569', fill: 'transparent', strokeWidth: 1.4 },
  towns: { stroke: '#94a3b8', fill: '#f1f5f9', strokeWidth: 0.5 },
  congressional: {
    stroke: '#7c3aed',
    fill: 'rgba(124,58,237,0.04)',
    strokeWidth: 1.2,
    dash: '4 3',
  },
  stateHouse: {
    stroke: '#0ea5e9',
    fill: 'transparent',
    strokeWidth: 0.7,
    dash: '2 2',
  },
  stateSenate: {
    stroke: '#dc2626',
    fill: 'transparent',
    strokeWidth: 1.0,
    dash: '6 3',
  },
}

const ORDER: LayerName[] = [
  'towns',
  'counties',
  'congressional',
  'stateHouse',
  'stateSenate',
]

export function MapBackground({
  camera,
  layers,
}: {
  camera: { x: number; y: number; z: number }
  layers: LayerState
}) {
  const [data, setData] = useState<Partial<Record<LayerName, ProjectedLayer>>>({})
  const { marked } = useIrlCouncils()

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

  // tldraw camera: screen = world * z + (cam.x, cam.y) * z
  // so SVG transform for world space is: scale(z) translate(cam.x, cam.y)
  const t = `translate(${camera.x * camera.z} ${camera.y * camera.z}) scale(${camera.z})`

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ background: '#f8fafc' }}
    >
      <g transform={t}>
        {ORDER.map((k) => {
          if (!layerEnabled(k, layers)) return null
          const layer = data[k]
          if (!layer) return null
          const s = STYLES[k]
          return (
            <g key={k}>
              {layer.features.map((f) => (
                <path
                  key={f.id}
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
              />
            ) : null,
          )}

        {layers.towns &&
          layers.townLabels &&
          data.towns?.features.map((f) =>
            f.population != null ? (
              <text
                key={`pop-${f.id}`}
                x={f.centroid[0]}
                y={f.centroid[1]}
                fontSize={Math.max(7, 9 / camera.z)}
                fill="#334155"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'rgba(248,250,252,0.85)',
                  strokeWidth: 3 / camera.z,
                }}
              >
                {f.population.toLocaleString()}
              </text>
            ) : null,
          )}
      </g>

      <g
        transform={t}
        pointerEvents="none"
        style={{ mixBlendMode: 'multiply' }}
      />
    </svg>
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
  }
}

void MAP_W
void MAP_H
