import { useEffect, useState } from 'react'
import { Board } from './Board'
import { LayerToggles, type LayerState, defaultLayers } from './LayerToggles'
import { FeatureRequestPanel } from './FeatureRequestPanel'

const LS_KEY = 'ma-power-map.layers'

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
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(layers))
  }, [layers])

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-slate-200 bg-white shrink-0">
        <h1 className="font-semibold text-slate-900 text-sm tracking-tight">
          MA Power Map
        </h1>
        <div className="h-5 w-px bg-slate-200" />
        <LayerToggles value={layers} onChange={setLayers} />
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
          >
            Request a feature
          </button>
        </div>
      </header>

      <main className="flex-1 relative min-h-0">
        <Board layers={layers} />
      </main>

      <FeatureRequestPanel open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
