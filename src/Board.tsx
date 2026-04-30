import { useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor, type TLComponents } from 'tldraw'
import { MapBackground } from './MapBackground'
import { usePersistence } from './persistence'
import type { LayerState } from './LayerToggles'

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
  onEditor,
}: {
  layers: LayerState
  popupTownId: string | null
  onTownClick: (townId: string | null) => void
  onEditor?: (e: Editor) => void
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
    () => ({ Background: () => null }),
    [],
  )

  return (
    <div className="absolute inset-0">
      <MapBackground
        camera={camera}
        layers={layers}
        popupTownId={popupTownId}
        onTownClick={onTownClick}
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
