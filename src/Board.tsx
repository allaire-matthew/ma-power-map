import { useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor, type TLComponents } from 'tldraw'
import { MapBackground } from './MapBackground'
import { usePersistence } from './persistence'
import type { LayerState } from './LayerToggles'
import type { TierFilter } from './App'

export function recenterCamera(editor: Editor) {
  const el = editor.getContainer()
  const vw = el.clientWidth
  const vh = el.clientHeight
  const z = Math.min(vw / 1700, vh / 1200)
  editor.setCamera({
    x: (vw - 1600 * z) / (2 * z),
    y: (vh - 1100 * z) / (2 * z),
    z,
  })
}

export function Board({
  layers,
  popupTownId,
  onTownClick,
  onShiftTownClick,
  onEditor,
  tierFilter,
  selectedTowns,
}: {
  layers: LayerState
  popupTownId: string | null
  onTownClick: (townId: string | null) => void
  onShiftTownClick?: (townId: string) => void
  onEditor?: (e: Editor) => void
  tierFilter: TierFilter
  selectedTowns?: Set<string>
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 })

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const c = editor.getCamera()
      setCamera({ x: c.x, y: c.y, z: c.z })
    }
    update()
    const unlisten = editor.store.listen(update)
    return () => unlisten()
  }, [editor])

  useEffect(() => {
    if (!editor) return
    recenterCamera(editor)
  }, [editor])

  usePersistence(editor)

  const components = useMemo<TLComponents>(
    () => ({
      Background: () => null,
      // The map is a data viewer — drawing tools are visual clutter and
      // the floating UI overlaps our own controls. Suppress everything
      // tldraw renders, but keep the editor mounted for pan/zoom + the
      // tldraw-driven camera state our SVG layer follows.
      StylePanel: () => null,
      Toolbar: () => null,
      MenuPanel: () => null,
      NavigationPanel: () => null,
      QuickActions: () => null,
      ActionsMenu: () => null,
      HelpMenu: () => null,
      DebugPanel: () => null,
      DebugMenu: () => null,
      ZoomMenu: () => null,
      MainMenu: () => null,
      PageMenu: () => null,
      KeyboardShortcutsDialog: () => null,
    }),
    [],
  )

  return (
    <div className="absolute inset-0">
      <MapBackground
        camera={camera}
        layers={layers}
        popupTownId={popupTownId}
        onTownClick={onTownClick}
        onShiftTownClick={onShiftTownClick}
        tierFilter={tierFilter}
        selectedTowns={selectedTowns}
      />
      <div className="absolute inset-0 tldraw-transparent">
        <Tldraw
          onMount={(e) => {
            setEditor(e)
            onEditor?.(e)
          }}
          options={{ maxPages: 1 }}
          components={components}
        />
      </div>
    </div>
  )
}
