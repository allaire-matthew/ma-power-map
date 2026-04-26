import { useEffect, useState } from 'react'
import { ref, onValue, set as fbSet } from 'firebase/database'
import { getFirebase, BOARD_PATH } from './firebase'

const LOCAL_KEY = 'ma-power-map.irlCouncils'

type Marked = Record<string, true>

function readLocal(): Marked {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Marked) : {}
  } catch {
    return {}
  }
}

function writeLocal(m: Marked) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(m))
  } catch {
    // ignore
  }
}

export function useIrlCouncils() {
  const [marked, setMarked] = useState<Marked>({})
  const [usingFirebase, setUsingFirebase] = useState(false)

  useEffect(() => {
    let stopped = false
    let unsub: (() => void) | null = null

    ;(async () => {
      const fb = await getFirebase()
      if (stopped) return
      if (fb) {
        setUsingFirebase(true)
        const r = ref(fb.db, `${BOARD_PATH}/irlCouncils`)
        unsub = onValue(r, (snap) => {
          const v = (snap.val() ?? {}) as Marked
          setMarked(v)
        })
      } else {
        setMarked(readLocal())
      }
    })()

    return () => {
      stopped = true
      unsub?.()
    }
  }, [])

  async function toggle(geoid: string) {
    const fb = await getFirebase()
    const next: Marked = { ...marked }
    if (next[geoid]) delete next[geoid]
    else next[geoid] = true
    if (fb) {
      await fbSet(ref(fb.db, `${BOARD_PATH}/irlCouncils`), next)
    } else {
      writeLocal(next)
      setMarked(next)
    }
  }

  return { marked, toggle, usingFirebase, count: Object.keys(marked).length }
}
