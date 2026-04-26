import { useEffect, useState } from 'react'
import type { Editor } from 'tldraw'
import { Board, recenterCamera } from './Board'
import { LayerToggles, type LayerState, defaultLayers } from './LayerToggles'
import { FeatureRequestPanel } from './FeatureRequestPanel'
import { IrlCouncilPanel } from './IrlCouncilPanel'

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

type Drawer = null | 'features' | 'irl'

export default function App() {
  const [layers, setLayers] = useState<LayerState>(loadLayers)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(layers))
  }, [layers])

  const clearBoard = () => {
    if (!editor) return
    if (!confirm('Delete all shapes on the board?')) return
    const ids = Array.from(editor.getCurrentPageShapeIds())
    if (ids.length) editor.deleteShapes(ids)
    recenterCamera(editor)
  }

  const recenter = () => {
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
          <button
            type="button"
            onClick={recenter}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
            title="Recenter map on Massachusetts"
          >
            Recenter
          </button>
          <button
            type="button"
            onClick={clearBoard}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
            title="Delete all shapes on the board"
          >
            Clear board
          </button>
          <button
            type="button"
            onClick={() => setDrawer((d) => (d === 'irl' ? null : 'irl'))}
            className={`text-sm px-3 py-1.5 rounded border ${
              drawer === 'irl'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            IRL Councils
          </button>
          <button
            type="button"
            onClick={() => setDrawer((d) => (d === 'features' ? null : 'features'))}
            className={`text-sm px-3 py-1.5 rounded border ${
              drawer === 'features'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            Request a feature
          </button>
        </div>
      </header>

      <main className="flex-1 relative min-h-0">
        <Board layers={layers} onEditor={setEditor} />
      </main>

      <FeatureRequestPanel
        open={drawer === 'features'}
        onClose={() => setDrawer(null)}
      />
      <IrlCouncilPanel
        open={drawer === 'irl'}
        onClose={() => setDrawer(null)}
      />
    </div>
  )
}
