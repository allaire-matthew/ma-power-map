import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MAP_W, MAP_H } from './geo'

export type Camera = { x: number; y: number; k: number }

const MIN_K = 0.15
const MAX_K = 40

function fitCamera(w: number, h: number): Camera {
  const k = Math.min(w / (MAP_W * 1.06), h / (MAP_H * 1.06))
  return { x: (w - MAP_W * k) / 2, y: (h - MAP_H * k) / 2, k }
}

/**
 * Pannable / zoomable SVG viewport. Replaces the tldraw whiteboard —
 * drag to pan, trackpad two-finger pan, pinch or wheel to zoom (cursor-
 * anchored), double-click to zoom in, keyboard arrows / + / -.
 * A click is only reported when the pointer moved < 5px (so drags never
 * select), and panning needs no focus dance — handlers live on the SVG.
 */
export function MapCanvas({
  children,
  onBackgroundClick,
  focusRef,
}: {
  children: (camera: Camera) => ReactNode
  onBackgroundClick?: () => void
  focusRef?: React.MutableRefObject<((c: [number, number], k?: number) => void) | null>
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [camera, setCamera] = useState<Camera | null>(null)

  // Active pointers for pinch; drag bookkeeping.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const pinch = useRef<{ dist: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const set = () => {
      const { clientWidth: w, clientHeight: h } = el
      if (w && h) setCamera((prev) => prev ?? fitCamera(w, h))
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const clampZoom = (k: number) => Math.max(MIN_K, Math.min(MAX_K, k))

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setCamera((c) => {
      if (!c) return c
      const k = clampZoom(c.k * factor)
      const scale = k / c.k
      return { k, x: px - (px - c.x) * scale, y: py - (py - c.y) * scale }
    })
  }, [])

  const panBy = useCallback((dx: number, dy: number) => {
    setCamera((c) => (c ? { ...c, x: c.x + dx, y: c.y + dy } : c))
  }, [])

  // Wheel: pinch-zoom (ctrlKey) and mouse-wheel zoom anchor to the cursor;
  // plain trackpad scroll pans. Non-passive so preventDefault works.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      if (e.ctrlKey || e.metaKey) {
        zoomAt(px, py, Math.exp(-e.deltaY * 0.012))
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2) {
        panBy(-e.deltaX, -e.deltaY)
      } else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 40 && !e.shiftKey) {
        // Trackpad two-finger scroll → pan (small pixel deltas).
        panBy(-e.deltaX, -e.deltaY)
      } else {
        // Discrete mouse wheel → zoom.
        zoomAt(px, py, Math.exp(-e.deltaY * 0.002))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, panBy])

  const onPointerDown = (e: React.PointerEvent) => {
    // Left button / touch only; let UI overlays handle their own events.
    if (e.button !== 0) return
    const target = e.target as Element
    if (target.closest('[data-map-ui]')) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      drag.current = { startX: e.clientX, startY: e.clientY, moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) }
      drag.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = wrapRef.current!.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - rect.left
      const my = (a.y + b.y) / 2 - rect.top
      if (pinch.current.dist > 0) zoomAt(mx, my, dist / pinch.current.dist)
      pinch.current.dist = dist
      return
    }
    if (drag.current) {
      const dx = cur.x - prev.x
      const dy = cur.y - prev.y
      if (
        Math.abs(cur.x - drag.current.startX) > 4 ||
        Math.abs(cur.y - drag.current.startY) > 4
      ) {
        drag.current.moved = true
      }
      if (drag.current.moved) panBy(dx, dy)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinch.current = null
    const wasDrag = drag.current?.moved
    if (pointers.current.size === 0) drag.current = null
    // Background click (not a drag, not on a feature/UI element).
    if (!wasDrag && e.target instanceof Element) {
      const onFeature = e.target.closest('[data-town],[data-map-ui]')
      if (!onFeature) onBackgroundClick?.()
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey ? 1 / 1.7 : 1.7)
  }

  const reset = () => {
    const el = wrapRef.current
    if (el) setCamera(fitCamera(el.clientWidth, el.clientHeight))
  }

  // Programmatic focus (search → fly to town). k target default 4.
  useEffect(() => {
    if (!focusRef) return
    focusRef.current = (pt: [number, number], k = 4) => {
      const el = wrapRef.current
      if (!el) return
      const kk = clampZoom(k)
      setCamera({
        k: kk,
        x: el.clientWidth / 2 - pt[0] * kk,
        y: el.clientHeight / 2 - pt[1] * kk,
      })
    }
    return () => {
      focusRef.current = null
    }
  }, [focusRef])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60
    if (e.key === 'ArrowLeft') panBy(step, 0)
    else if (e.key === 'ArrowRight') panBy(-step, 0)
    else if (e.key === 'ArrowUp') panBy(0, step)
    else if (e.key === 'ArrowDown') panBy(0, -step)
    else if (e.key === '+' || e.key === '=') {
      const el = wrapRef.current!
      zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.3)
    } else if (e.key === '-') {
      const el = wrapRef.current!
      zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.3)
    } else return
    e.preventDefault()
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden touch-none select-none"
      style={{ background: 'var(--map-surface)', cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Massachusetts map — drag to pan, scroll or pinch to zoom, arrow keys to pan"
    >
      {camera && (
        <svg className="w-full h-full block" style={{ pointerEvents: 'all' }}>
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
            {children(camera)}
          </g>
        </svg>
      )}
      {/* Zoom cluster — floating chrome (DESIGN.md F3). */}
      <div
        data-map-ui
        className="absolute right-3 bottom-3 flex flex-col rounded-lg border shadow-sm overflow-hidden"
        style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}
      >
        <ZoomBtn label="Zoom in" onClick={() => {
          const el = wrapRef.current!
          zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.4)
        }}>+</ZoomBtn>
        <ZoomBtn label="Zoom out" onClick={() => {
          const el = wrapRef.current!
          zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.4)
        }}>−</ZoomBtn>
        <ZoomBtn label="Fit Massachusetts" onClick={reset}>⌂</ZoomBtn>
      </div>
    </div>
  )
}

function ZoomBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-map-ui
      title={label}
      aria-label={label}
      onClick={onClick}
      className="w-10 h-10 flex items-center justify-center text-base leading-none border-b last:border-b-0 hover:bg-black/[.06] active:bg-black/[.12]"
      style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
    >
      {children}
    </button>
  )
}
