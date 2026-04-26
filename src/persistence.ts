import { useEffect } from 'react'
import { getSnapshot, loadSnapshot, type Editor } from 'tldraw'
import { ref, get, set, onValue } from 'firebase/database'
import { getFirebase, BOARD_PATH } from './firebase'

const LOCAL_KEY = 'ma-power-map.tldraw'
const DEBOUNCE_MS = 500

export function usePersistence(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    let stopped = false
    let cleanups: Array<() => void> = []

    ;(async () => {
      const fb = await getFirebase()
      if (stopped) return

      if (fb) {
        cleanups = setupFirebase(editor, fb.db)
      } else {
        cleanups = setupLocal(editor)
      }
    })()

    return () => {
      stopped = true
      cleanups.forEach((c) => c())
    }
  }, [editor])
}

function setupLocal(editor: Editor): Array<() => void> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) loadSnapshot(editor.store, JSON.parse(raw))
  } catch {
    // ignore
  }
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsub = editor.store.listen(
    () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            LOCAL_KEY,
            JSON.stringify(getSnapshot(editor.store)),
          )
        } catch {
          // ignore quota
        }
      }, DEBOUNCE_MS)
    },
    { source: 'user', scope: 'document' },
  )
  return [
    () => {
      unsub()
      if (timer) clearTimeout(timer)
    },
  ]
}

function setupFirebase(editor: Editor, db: ReturnType<typeof import('firebase/database').getDatabase>): Array<() => void> {
  const docRef = ref(db, `${BOARD_PATH}/tldraw`)
  let lastWriteTs = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let cleanups: Array<() => void> = []
  let initialized = false

  ;(async () => {
    const snap = await get(docRef)
    if (snap.exists()) {
      const data = snap.val() as { snapshot?: unknown; updatedAt?: number }
      if (data?.snapshot) {
        loadSnapshot(editor.store, data.snapshot as Parameters<typeof loadSnapshot>[1])
        lastWriteTs = data.updatedAt ?? 0
      }
    }
    initialized = true
  })()

  const localUnsub = editor.store.listen(
    () => {
      if (!initialized) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const updatedAt = Date.now()
        lastWriteTs = updatedAt
        void set(docRef, {
          snapshot: getSnapshot(editor.store),
          updatedAt,
        })
      }, DEBOUNCE_MS)
    },
    { source: 'user', scope: 'document' },
  )

  const remoteUnsub = onValue(docRef, (snap) => {
    if (!snap.exists()) return
    const data = snap.val() as { snapshot?: unknown; updatedAt?: number }
    if (
      initialized &&
      data?.updatedAt &&
      data.updatedAt > lastWriteTs &&
      data.snapshot
    ) {
      loadSnapshot(editor.store, data.snapshot as Parameters<typeof loadSnapshot>[1])
      lastWriteTs = data.updatedAt
    }
  })

  cleanups.push(() => localUnsub())
  cleanups.push(() => remoteUnsub())
  cleanups.push(() => {
    if (timer) clearTimeout(timer)
  })
  return cleanups
}
