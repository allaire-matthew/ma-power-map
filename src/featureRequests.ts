import { useEffect, useState } from 'react'
import { ref, onValue, set } from 'firebase/database'
import { getFirebase, BOARD_PATH } from './firebase'

export type FeatureRequest = {
  id: string
  text: string
  createdAt: number
  status: 'open' | 'done'
}

const LOCAL_KEY = 'ma-power-map.featureRequests'

function readLocal(): FeatureRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as FeatureRequest[]) : []
  } catch {
    return []
  }
}

function writeLocal(rs: FeatureRequest[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rs))
  } catch {
    // ignore
  }
}

function newId() {
  return `fr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function useFeatureRequests() {
  const [items, setItems] = useState<FeatureRequest[]>([])
  const [usingFirebase, setUsingFirebase] = useState(false)

  useEffect(() => {
    let stopped = false
    let unsub: (() => void) | null = null

    ;(async () => {
      const fb = await getFirebase()
      if (stopped) return
      if (fb) {
        setUsingFirebase(true)
        const r = ref(fb.db, `${BOARD_PATH}/featureRequests`)
        unsub = onValue(r, (snap) => {
          const v = (snap.val() ?? []) as FeatureRequest[] | Record<string, FeatureRequest>
          const arr = Array.isArray(v) ? v : Object.values(v)
          arr.sort((a, b) => b.createdAt - a.createdAt)
          setItems(arr)
        })
      } else {
        setItems(readLocal())
      }
    })()

    return () => {
      stopped = true
      unsub?.()
    }
  }, [])

  async function add(text: string) {
    const item: FeatureRequest = {
      id: newId(),
      text: text.trim(),
      createdAt: Date.now(),
      status: 'open',
    }
    if (!item.text) return
    const fb = await getFirebase()
    if (fb) {
      const next = [item, ...items]
      await set(ref(fb.db, `${BOARD_PATH}/featureRequests`), next)
    } else {
      const next = [item, ...readLocal()]
      writeLocal(next)
      setItems(next)
    }
  }

  async function markDone(id: string) {
    const updater = (rs: FeatureRequest[]) =>
      rs.map((r) => (r.id === id ? { ...r, status: 'done' as const } : r))
    const fb = await getFirebase()
    if (fb) {
      const next = updater(items)
      await set(ref(fb.db, `${BOARD_PATH}/featureRequests`), next)
    } else {
      const next = updater(readLocal())
      writeLocal(next)
      setItems(next)
    }
  }

  return { items, add, markDone, usingFirebase }
}
