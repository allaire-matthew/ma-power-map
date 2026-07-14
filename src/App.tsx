import { useEffect, useMemo, useRef, useState } from 'react'
import { loadWorld, type World } from './model'
import type { Lens } from './MapLayers'
import { MapView } from './views/MapView'
import { GroupsView } from './views/GroupsView'
import { EdTechView } from './views/EdTechView'
import { DetailPanel } from './DetailPanel'
import { GuidePanel } from './GuidePanel'
import { StatTile } from './ui'
import { EDTECH } from './colors'

type View = 'map' | 'groups' | 'edtech'

const VIEWS: { key: View; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'groups', label: 'Local groups' },
  { key: 'edtech', label: 'EdTech' },
]

export default function App() {
  const [world, setWorld] = useState<World | null>(null)
  const [view, setView] = useState<View>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens>('organizing')
  const [guideOpen, setGuideOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const flyTo = useRef<((c: [number, number], k?: number) => void) | null>(null)

  useEffect(() => {
    void loadWorld().then(setWorld)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (guideOpen) setGuideOpen(false)
        else setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guideOpen])

  const searchMatches = useMemo(() => {
    if (!world) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const prefix: typeof world.towns = []
    const substr: typeof world.towns = []
    for (const t of world.towns) {
      const n = t.name.toLowerCase()
      if (n.startsWith(q)) prefix.push(t)
      else if (n.includes(q)) substr.push(t)
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
    return [...prefix.sort(byName), ...substr.sort(byName)].slice(0, 8)
  }, [searchQuery, world])

  const setQuery = (q: string) => {
    setSearchQuery(q)
    setActiveIndex(0) // highlight resets with the result set
  }

  const pickTown = (id: string) => {
    setSelectedId(id)
    setSearchQuery('')
    const t = world?.towns.find((f) => f.id === id)
    if (t && view === 'map') flyTo.current?.(t.centroid, 3)
  }

  const selected = selectedId && world ? world.records.get(selectedId) ?? null : null

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header — identity, views, search, guide (DESIGN.md F2). */}
      <header
        className="shrink-0 flex items-center gap-4 px-4 h-13"
        style={{ background: 'var(--card)', boxShadow: 'inset 0 -1px var(--hairline)', height: 52 }}
      >
        <h1 className="m-0 flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-wordmark text-[17px] font-semibold" style={{ color: 'var(--navy)' }}>
            MA Power Map
          </span>
        </h1>

        <nav className="flex items-center gap-1" aria-label="Views">
          {VIEWS.map((v) => {
            const active = view === v.key
            return (
              <button
                key={v.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(v.key)}
                className="px-3 h-9 rounded-md text-[13px] font-semibold hover:bg-black/[.05] active:bg-black/[.1]"
                style={{
                  color: active ? 'var(--navy)' : 'var(--ink-2)',
                  boxShadow: active ? 'inset 0 -2px var(--navy)' : undefined,
                  borderRadius: active ? '6px 6px 0 0' : 6,
                }}
              >
                {v.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any town…"
              role="combobox"
              aria-expanded={searchMatches.length > 0}
              aria-controls="town-search-listbox"
              aria-activedescendant={
                searchMatches.length > 0 ? `town-opt-${searchMatches[activeIndex]?.id}` : undefined
              }
              autoComplete="off"
              className="h-9 w-40 md:w-52 px-2.5 text-[13px] rounded-md border"
              style={{ borderColor: 'var(--hairline)', background: 'var(--paper)', color: 'var(--ink)' }}
              onKeyDown={(e) => {
                if (searchMatches.length === 0) {
                  if (e.key === 'Escape') setSearchQuery('')
                  return
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveIndex((i) => (i + 1) % searchMatches.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const m = searchMatches[activeIndex] ?? searchMatches[0]
                  if (m) pickTown(m.id)
                } else if (e.key === 'Escape') {
                  setSearchQuery('')
                }
              }}
            />
            {searchMatches.length > 0 && (
              <ul
                id="town-search-listbox"
                role="listbox"
                className="absolute right-0 top-10 w-60 max-h-72 overflow-auto rounded-lg border shadow-lg z-40 py-1"
                style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
              >
                {searchMatches.map((t, i) => {
                  const active = i === activeIndex
                  return (
                    <li key={t.id} id={`town-opt-${t.id}`} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => pickTown(t.id)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className="flex items-baseline justify-between w-full text-left px-2.5 py-1.5 text-[13px]"
                        style={{ background: active ? '#0f213710' : undefined, color: 'var(--ink)' }}
                      >
                        <span className="truncate">{t.name}</span>
                        {t.population != null && (
                          <span className="ml-2 shrink-0 tnum text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                            {t.population.toLocaleString()}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="h-9 px-3 rounded-md border text-[13px] font-semibold hover:bg-black/[.04]"
            style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)', background: 'var(--card)' }}
          >
            Guide
          </button>
        </div>
      </header>

      {/* KPI strip — contextual to what's being examined; the accent color
          matches the active lens's encoding (DESIGN.md C1, D1, F2). */}
      {world && view !== 'edtech' && <KpiStrip world={world} mode={view === 'map' ? lens : 'groups'} />}

      {/* Content + detail panel (list-detail, DESIGN.md F1). */}
      <main className="flex-1 min-h-0 flex">
        <div className="flex-1 relative min-w-0">
          {!world ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                Loading Massachusetts…
              </div>
            </div>
          ) : view === 'map' ? (
            <MapView world={world} selectedId={selectedId} onSelect={setSelectedId} focusRef={flyTo} lens={lens} onLensChange={setLens} />
          ) : view === 'edtech' ? (
            <EdTechView />
          ) : (
            <GroupsView world={world} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
        {selected && (
          <div className="hidden md:block h-full shrink-0">
            <DetailPanel rec={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </main>

      {/* Mobile detail panel — slides over (DESIGN.md F1 compact). */}
      {selected && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end" onClick={() => setSelectedId(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(15,33,55,0.28)' }} />
          <div className="relative h-full" onClick={(e) => e.stopPropagation()}>
            <DetailPanel rec={selected} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}

      {guideOpen && <GuidePanel world={world} onClose={() => setGuideOpen(false)} />}
    </div>
  )
}

// Per-mode KPI tiles — each is a direct count of what the active view
// draws (tier fills, group towns). Nothing derived.
const KPI_MODES = {
  policy: {
    label: 'Phone policy',
    color: '#2f9e4f',
    tiles: (k: World['kpis']) => [
      { label: 'Tier 4 districts', value: String(k.tier4), sub: `of ${k.districtsTotal}` },
      { label: 'Tier 3 districts', value: String(k.tier3) },
      { label: 'Tier 2 districts', value: String(k.tier2) },
      { label: 'Tier 1 · no policy', value: String(k.tier1) },
    ],
  },
  organizing: {
    label: 'Organizing',
    color: '#7c3aed',
    tiles: (k: World['kpis']) => [
      { label: 'Local groups', value: String(k.localGroups) },
      { label: 'Towns with local groups', value: String(k.localGroupTowns) },
      { label: 'Towns with 2+ groups', value: String(k.towns2plus) },
    ],
  },
  edtech: {
    label: 'EdTech',
    color: EDTECH,
    tiles: (k: World['kpis']) => [
      { label: 'Districts profiled', value: String(k.edtechProfiled) },
      {
        label: 'Take-home 1:1 districts',
        value: String(k.edtechTakeHome),
        sub: `of ${k.edtechProfiled} profiled`,
      },
      { label: 'AI-pilot districts statewide', value: String(k.aiPilotDistricts) },
    ],
  },
  groups: {
    label: 'Local groups',
    color: '#7c3aed',
    tiles: (k: World['kpis']) => [
      { label: 'Local groups', value: String(k.localGroups) },
      { label: 'Towns with local groups', value: String(k.localGroupTowns) },
      { label: 'Towns with 2+ groups', value: String(k.towns2plus) },
    ],
  },
}

function KpiStrip({ world, mode }: { world: World; mode: Lens | 'groups' }) {
  const m = KPI_MODES[mode]
  return (
    <div
      className="shrink-0 px-4 py-2.5 flex items-center gap-x-6 gap-y-2 flex-wrap"
      style={{
        background: `${m.color}0c`,
        boxShadow: `inset 0 3px 0 ${m.color}, inset 0 -1px var(--hairline)`,
      }}
    >
      <span
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide text-white shrink-0"
        style={{ background: m.color }}
      >
        {m.label}
      </span>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
        {m.tiles(world.kpis).map((t: { label: string; value: string; sub?: string }) => (
          <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} />
        ))}
      </div>
    </div>
  )
}
