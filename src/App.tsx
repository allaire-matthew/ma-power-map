import { useEffect, useMemo, useState } from 'react'
import type { Editor } from 'tldraw'
import { Board, recenterCamera } from './Board'
import { LayerToggles, type LayerState, defaultLayers } from './LayerToggles'
import { Legend } from './Legend'
import { TownPopup } from './TownPopup'
import { loadLayer, type PhoneTier, type ProjectedFeature } from './geo'

export type TierFilter = 'all' | PhoneTier

// v3: split stateLegislature into stateSenate + stateHouse and added counties
// as a first-class geographic layer. Older clients with v2 keys get the new
// defaults instead of a stuck-on combined-leg toggle.
const LS_KEY = 'ma-power-map.layers.v3'

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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedTowns, setSelectedTowns] = useState<Set<string>>(new Set())

  const toggleSelected = (id: string) => {
    setSelectedTowns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelected = () => setSelectedTowns(new Set())

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
      if (e.key === 'Escape') {
        if (selectMode) setSelectMode(false)
        else setPopupTownId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectMode])

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
      <header className="flex items-center gap-3 px-4 h-12 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        <h1 className="font-semibold text-slate-900 text-sm tracking-tight whitespace-nowrap">
          MA Power Map
        </h1>
        <div className="h-5 w-px bg-slate-200" />
        <LayerToggles value={layers} onChange={setLayers} />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectMode((v) => !v)}
            title="Toggle multi-select tool (click towns to add/remove). Shift+click also toggles regardless of this mode."
            className={`h-8 px-2.5 text-xs rounded border transition-colors whitespace-nowrap ${
              selectMode
                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {selectMode ? '◉ Selecting' : '○ Select towns'}
            {selectedTowns.size > 0 && (
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] tabular-nums font-semibold ${
                  selectMode ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {selectedTowns.size}
              </span>
            )}
          </button>
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
          onTownClick={(id) => {
            if (id == null) {
              setPopupTownId(null)
              return
            }
            if (selectMode) toggleSelected(id)
            else setPopupTownId(id)
          }}
          onShiftTownClick={toggleSelected}
          onEditor={setEditor}
          tierFilter={tierFilter}
          selectedTowns={selectedTowns}
        />
        <Legend
          layers={layers}
          tierFilter={tierFilter}
          onTierFilter={setTierFilter}
        />
        {selectedTowns.size > 0 && (
          <SelectionPanel
            selectedIds={selectedTowns}
            townOptions={townOptions}
            onRemove={toggleSelected}
            onClear={clearSelected}
            onOpen={(id) => setPopupTownId(id)}
          />
        )}
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

function SelectionPanel({
  selectedIds,
  townOptions,
  onRemove,
  onClear,
  onOpen,
}: {
  selectedIds: Set<string>
  townOptions: ProjectedFeature[]
  onRemove: (id: string) => void
  onClear: () => void
  onOpen: (id: string) => void
}) {
  const selected = townOptions
    .filter((t) => selectedIds.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const totalPop = selected.reduce((sum, t) => sum + (t.population ?? 0), 0)
  return (
    <aside
      data-map-ui
      className="absolute left-3 top-3 z-20 w-64 bg-white/95 backdrop-blur border border-slate-200 rounded-md shadow-lg text-[12px] text-slate-700"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
          Selected ({selected.length})
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-rose-600"
        >
          Clear
        </button>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          Combined population
        </div>
        <div className="text-slate-900 font-semibold tabular-nums">
          {totalPop.toLocaleString()}
        </div>
      </div>
      <ul className="max-h-72 overflow-auto border-t border-slate-100">
        {selected.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between px-3 py-1.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50"
          >
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              className="text-left flex-1 min-w-0"
            >
              <div className="text-slate-900 truncate">{t.name}</div>
              {t.population != null && (
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {t.population.toLocaleString()}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(t.id)}
              title="Remove"
              className="ml-2 text-slate-400 hover:text-rose-600 text-[14px] leading-none"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
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
