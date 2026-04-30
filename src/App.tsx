import { useEffect, useMemo, useState } from 'react'
import type { Editor } from 'tldraw'
import { Board, recenterCamera } from './Board'
import { LayerToggles, type LayerState, defaultLayers } from './LayerToggles'
import { Legend } from './Legend'
import { TownPopup } from './TownPopup'
import { loadLayer, type PhoneTier, type ProjectedFeature } from './geo'

export type TierFilter = 'all' | PhoneTier

// Bumped from `ma-power-map.layers` to force-clear the stale toggle set
// (counties/towns/irlCouncil) that lingered after the redesign.
const LS_KEY = 'ma-power-map.layers.v2'

function loadLayers(): LayerState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return defaultLayers
    return { ...defaultLayers, ...JSON.parse(raw) }
  } catch {
    return defaultLayers
  }
}

export default function App() {
  const [layers, setLayers] = useState<LayerState>(loadLayers)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [popupTownId, setPopupTownId] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [townOptions, setTownOptions] = useState<ProjectedFeature[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadLayer('towns').then((l) => {
      if (!cancelled) setTownOptions(l.features)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return townOptions
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, townOptions])

  const pickTown = (id: string) => {
    setPopupTownId(id)
    setSearchQuery('')
  }

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(layers))
  }, [layers])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopupTownId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const zoomBy = (factor: number) => {
    if (!editor) return
    const c = editor.getCamera()
    const el = editor.getContainer()
    const cx = el.clientWidth / 2
    const cy = el.clientHeight / 2
    const newZ = Math.max(0.1, Math.min(8, c.z * factor))
    // Keep the screen-center pinned while zooming.
    const wx = cx / c.z - c.x
    const wy = cy / c.z - c.y
    const newX = cx / newZ - wx
    const newY = cy / newZ - wy
    editor.setCamera({ x: newX, y: newY, z: newZ })
  }

  const reset = () => {
    if (editor) recenterCamera(editor)
  }

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-slate-200 bg-white shrink-0">
        <h1 className="font-semibold text-slate-900 text-sm tracking-tight">
          MA Power Map
        </h1>
        <div className="h-5 w-px bg-slate-200" />
        <LayerToggles value={layers} onChange={setLayers} />
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search town…"
              className="h-8 w-44 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchMatches.length > 0) {
                  pickTown(searchMatches[0].id)
                } else if (e.key === 'Escape') {
                  setSearchQuery('')
                }
              }}
            />
            {searchMatches.length > 0 && (
              <ul className="absolute right-0 top-9 w-56 max-h-64 overflow-auto bg-white border border-slate-200 rounded shadow-lg z-30">
                {searchMatches.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => pickTown(t.id)}
                      className="block w-full text-left px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      <span className="text-slate-900">{t.name}</span>
                      {t.population != null && (
                        <span className="text-slate-400 ml-1.5 tabular-nums">
                          {t.population.toLocaleString()}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <IconButton onClick={() => zoomBy(1.25)} label="Zoom in">
            +
          </IconButton>
          <IconButton onClick={() => zoomBy(1 / 1.25)} label="Zoom out">
            −
          </IconButton>
          <IconButton onClick={reset} label="Reset view">
            ⟲
          </IconButton>
        </div>
      </header>

      <main className="flex-1 relative min-h-0">
        <Board
          layers={layers}
          popupTownId={popupTownId}
          onTownClick={setPopupTownId}
          onEditor={setEditor}
          tierFilter={tierFilter}
        />
        <Legend
          layers={layers}
          tierFilter={tierFilter}
          onTierFilter={setTierFilter}
        />
        {popupTownId && (
          <TownPopup
            townId={popupTownId}
            onClose={() => setPopupTownId(null)}
          />
        )}
      </main>
    </div>
  )
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-base font-medium leading-none"
    >
      {children}
    </button>
  )
}
