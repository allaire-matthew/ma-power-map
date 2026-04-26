import { useEffect, useMemo, useState } from 'react'
import { loadLayer, type ProjectedFeature } from './geo'
import { useIrlCouncils } from './irlCouncils'

export function IrlCouncilPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { marked, toggle, usingFirebase, count } = useIrlCouncils()
  const [towns, setTowns] = useState<ProjectedFeature[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadLayer('towns').then((l) => {
      if (cancelled) return
      const sorted = [...l.features].sort((a, b) => a.name.localeCompare(b.name))
      setTowns(sorted)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return towns
    return towns.filter((t) => t.name.toLowerCase().includes(q))
  }, [towns, query])

  if (!open) return null

  const allFilteredMarked =
    filtered.length > 0 && filtered.every((t) => marked[t.id])

  const bulkSet = async (mark: boolean) => {
    for (const t of filtered) {
      if (!!marked[t.id] !== mark) {
        await toggle(t.id)
      }
    }
  }

  return (
    <aside className="absolute top-12 right-0 bottom-0 w-96 bg-white border-l border-slate-200 shadow-lg z-30 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          IRL Councils
          <span className="ml-2 text-xs text-slate-500 font-normal">
            {count} marked
          </span>
        </h2>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 text-lg leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-3 border-b border-slate-200 space-y-2">
        <input
          type="text"
          placeholder="Search towns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {filtered.length} town{filtered.length === 1 ? '' : 's'}{' '}
            {query && 'match'}
            {usingFirebase ? ' · shared' : ' · local'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => bulkSet(true)}
              disabled={filtered.length === 0 || allFilteredMarked}
              className="text-indigo-600 hover:text-indigo-800 disabled:text-slate-300"
            >
              Mark all{query && ' (filtered)'}
            </button>
            <button
              type="button"
              onClick={() => bulkSet(false)}
              disabled={filtered.length === 0}
              className="text-slate-600 hover:text-slate-900 disabled:text-slate-300"
            >
              Clear{query && ' (filtered)'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100"
          >
            <input
              type="checkbox"
              checked={!!marked[t.id]}
              onChange={() => toggle(t.id)}
              className="accent-emerald-600"
            />
            <span className="flex-1 truncate">{t.name}</span>
            {t.population != null && (
              <span className="text-[11px] text-slate-400 tabular-nums">
                {t.population.toLocaleString()}
              </span>
            )}
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 p-3">No towns match.</p>
        )}
      </div>
    </aside>
  )
}
