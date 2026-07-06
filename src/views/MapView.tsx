import { useMemo, useRef, useState } from 'react'
import type { PhoneTier } from '../geo'
import type { World } from '../model'
import { MapCanvas } from '../MapCanvas'
import {
  MapLayers,
  type BoundaryKey,
  type Lens,
  type TierFilter,
} from '../MapLayers'
import { PRESENCE, STAGE_COLOR, STAGE_NAME, TIER_COLOR, TIER_SHORT } from '../colors'

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: 'chapters', label: 'Chapters', hint: 'CIRL chapter pipeline, with parent organizing as context' },
  { key: 'policy', label: 'Phone policy', hint: 'District phone-policy strength, Tier 1–4' },
  { key: 'organizing', label: 'Organizing', hint: 'Where local groups are active' },
]

const BOUNDARY_OPTIONS: { key: BoundaryKey; label: string }[] = [
  { key: 'counties', label: 'Counties' },
  { key: 'school', label: 'School districts' },
  { key: 'congressional', label: 'US House' },
  { key: 'stateSenate', label: 'MA Senate' },
  { key: 'stateHouse', label: 'MA House' },
]

export function MapView({
  world,
  selectedId,
  onSelect,
  focusRef,
}: {
  world: World
  selectedId: string | null
  onSelect: (id: string | null) => void
  focusRef: React.MutableRefObject<((c: [number, number], k?: number) => void) | null>
}) {
  const [lens, setLens] = useState<Lens>('chapters')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [boundaries, setBoundaries] = useState<Set<BoundaryKey>>(new Set())
  const [showBoundaries, setShowBoundaries] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const hoverRec = hover ? world.records.get(hover.id) : null
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const toggleBoundary = (key: BoundaryKey) =>
    setBoundaries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const hoverLine = useMemo(() => {
    if (!hoverRec) return null
    const bits: string[] = []
    if (hoverRec.pipeline)
      bits.push(`Stage ${hoverRec.pipeline.stage} · ${STAGE_NAME[hoverRec.pipeline.stage]}`)
    if (lens === 'policy') bits.push(TIER_SHORT[hoverRec.policy?.tier ?? 1])
    else if (hoverRec.orgs.length > 0)
      bits.push(`${hoverRec.orgs.length} local group${hoverRec.orgs.length > 1 ? 's' : ''}`)
    return bits.join(' · ')
  }, [hoverRec, lens])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <MapCanvas focusRef={focusRef} onBackgroundClick={() => onSelect(null)}>
        {(camera) => (
          <MapLayers
            world={world}
            k={camera.k}
            lens={lens}
            tierFilter={tierFilter}
            boundaries={boundaries}
            selectedId={selectedId}
            onSelect={onSelect}
            onHover={setHover}
          />
        )}
      </MapCanvas>

      {/* Lens switcher — top-left floating chrome (DESIGN.md F3/G1). */}
      <div data-map-ui className="absolute left-3 top-3 flex flex-col gap-2 items-start">
        <div
          className="inline-flex rounded-lg border shadow-sm overflow-hidden"
          style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)' }}
          role="tablist"
          aria-label="Map lens"
        >
          {LENSES.map((l) => {
            const active = l.key === lens
            return (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={l.hint}
                onClick={() => setLens(l.key)}
                className="px-3 h-9 text-[12.5px] font-semibold border-r last:border-r-0 hover:bg-black/[.05] active:bg-black/[.1]"
                style={{
                  borderColor: 'var(--hairline)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  background: active ? 'var(--navy)' : 'transparent',
                }}
              >
                {l.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setShowBoundaries((v) => !v)}
            aria-expanded={showBoundaries}
            title="Overlay boundaries"
            className="px-3 h-9 text-[12.5px] hover:bg-black/[.05]"
            style={{ color: boundaries.size ? 'var(--ink)' : 'var(--ink-3)' }}
          >
            Boundaries{boundaries.size > 0 ? ` (${boundaries.size})` : ''} ▾
          </button>
        </div>

        {showBoundaries && (
          <div
            className="rounded-lg border shadow-md px-3 py-2 flex flex-col gap-1.5"
            style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.97)' }}
          >
            {BOUNDARY_OPTIONS.map((b) => (
              <label key={b.key} className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                <input
                  type="checkbox"
                  checked={boundaries.has(b.key)}
                  onChange={() => toggleBoundary(b.key)}
                  style={{ accentColor: 'var(--navy)' }}
                />
                {b.label}
              </label>
            ))}
          </div>
        )}

        {/* Tier filter chips — policy lens only. */}
        {lens === 'policy' && (
          <div
            className="inline-flex rounded-lg border shadow-sm overflow-hidden"
            style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.94)' }}
            role="group"
            aria-label="Filter by tier"
          >
            {(['all', 1, 2, 3, 4] as const).map((t) => {
              const active = tierFilter === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTierFilter(t as TierFilter)}
                  className="px-2.5 h-8 text-[12px] font-semibold border-r last:border-r-0 hover:bg-black/[.05]"
                  style={{
                    borderColor: 'var(--hairline)',
                    color: active ? '#fff' : 'var(--ink-2)',
                    background: active ? 'var(--navy)' : 'transparent',
                  }}
                >
                  {t === 'all' ? 'All' : `Tier ${t}`}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend — always visible on the map (DESIGN.md H1). */}
      <div
        data-map-ui
        className="absolute left-3 bottom-3 rounded-lg border shadow-sm px-3 py-2.5"
        style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)', maxWidth: 240 }}
      >
        {lens === 'chapters' && (
          <LegendRows
            title="Chapter stage"
            rows={[1, 2, 3, 4, 5].map((s) => ({
              swatch: STAGE_COLOR[s],
              label: `${s} · ${STAGE_NAME[s]}`,
            }))}
            extra={[
              { swatch: PRESENCE, label: 'Local group active', alpha: 0.35 },
            ]}
          />
        )}
        {lens === 'policy' && (
          <LegendRows
            title="Phone-policy tier (district)"
            rows={([1, 2, 3, 4] as PhoneTier[]).map((t) => ({
              swatch: TIER_COLOR[t],
              label: TIER_SHORT[t],
              outline: t === 1,
            }))}
          />
        )}
        {lens === 'organizing' && (
          <LegendRows
            title="Local groups"
            rows={[
              { swatch: PRESENCE, label: '2+ groups', alpha: 0.55 },
              { swatch: PRESENCE, label: '1 group', alpha: 0.3 },
            ]}
          />
        )}
      </div>

      {/* Hover tooltip — enhances, never gates (DESIGN.md G3). */}
      {hover && hoverRec && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border shadow-md px-2.5 py-1.5"
          style={{
            left: hover.x + 14,
            top: hover.y + 14,
            borderColor: 'var(--hairline)',
            background: 'rgba(255,255,255,0.97)',
          }}
        >
          <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {hoverRec.name}
          </div>
          {hoverLine && (
            <div className="text-[11.5px] leading-tight" style={{ color: 'var(--ink-2)' }}>
              {hoverLine}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LegendRows({
  title,
  rows,
  extra,
}: {
  title: string
  rows: { swatch: string; label: string; alpha?: number; outline?: boolean }[]
  extra?: { swatch: string; label: string; alpha?: number }[]
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-3)' }}>
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <LegendRow key={r.label} {...r} />
        ))}
        {extra && <div className="h-px my-0.5" style={{ background: 'var(--hairline)' }} />}
        {extra?.map((r) => (
          <LegendRow key={r.label} {...r} />
        ))}
      </div>
    </div>
  )
}

function LegendRow({
  swatch,
  label,
  alpha,
  outline,
}: {
  swatch: string
  label: string
  alpha?: number
  outline?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>
      <span
        aria-hidden
        className="w-3.5 h-3.5 rounded-[3px] shrink-0"
        style={{
          background: swatch,
          opacity: alpha ?? 1,
          border: outline ? '1px solid #c9c6bd' : undefined,
        }}
      />
      {label}
    </div>
  )
}
