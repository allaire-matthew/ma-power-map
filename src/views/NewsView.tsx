import { useMemo, useState } from 'react'
import type { World } from '../model'
import { fmtDate } from '../model'
import { FilterChip } from '../ui'

export function NewsView({
  world,
  onSelectTown,
}: {
  world: World
  onSelectTown: (id: string) => void
}) {
  const [townFilter, setTownFilter] = useState<string | null>(null) // town key

  const items = useMemo(() => {
    const all = world.news?.items ?? []
    const filtered = townFilter ? all.filter((i) => i.town === townFilter) : all
    return [...filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [world.news, townFilter])

  const townChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of world.news?.items ?? []) {
      if (i.town) counts.set(i.town, (counts.get(i.town) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([key, n]) => ({ key, n, rec: world.byKey.get(key) }))
      .filter((t) => t.rec)
      .sort((a, b) => b.n - a.n)
  }, [world.news, world.byKey])

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[760px] mx-auto px-4 py-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            Latest signal
            <span className="font-normal text-[12.5px] ml-2" style={{ color: 'var(--ink-3)' }}>
              MA news relevant to chapter and prospect towns, refreshed daily
            </span>
          </h2>
          {world.news?._lastUpdated && (
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Updated {fmtDate(world.news._lastUpdated)}
            </span>
          )}
        </div>

        {townChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {townFilter ? (
              <FilterChip onRemove={() => setTownFilter(null)}>
                {world.byKey.get(townFilter)?.name ?? townFilter}
              </FilterChip>
            ) : (
              townChips.slice(0, 12).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTownFilter(t.key)}
                  className="px-2.5 h-7 rounded-full border text-[12px] hover:bg-black/[.04]"
                  style={{ borderColor: 'var(--hairline)', background: 'var(--card)', color: 'var(--ink-2)' }}
                >
                  {t.rec!.name} <span style={{ color: 'var(--ink-3)' }}>{t.n}</span>
                </button>
              ))
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div
            className="rounded-xl border px-5 py-10 text-center text-[13px]"
            style={{ borderColor: 'var(--hairline)', background: 'var(--card)', color: 'var(--ink-2)' }}
          >
            {world.news
              ? 'Nothing in the last window for this filter.'
              : 'No news yet — the daily refresh (GitHub Actions, 7:17 UTC) writes data/news.json. It will appear here after the first run.'}
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map((item, i) => {
              const rec = item.town ? world.byKey.get(item.town) : null
              return (
                <li
                  key={`${item.url}-${i}`}
                  className="py-2.5 flex flex-col gap-0.5"
                  style={{ boxShadow: 'inset 0 -1px var(--hairline)' }}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13.5px] font-semibold leading-snug hover:underline underline-offset-2"
                    style={{ color: 'var(--ink)' }}
                  >
                    {item.title}
                  </a>
                  <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    <span>{item.source}</span>
                    <span aria-hidden>·</span>
                    <span>{fmtDate(item.date)}</span>
                    {rec && (
                      <>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          onClick={() => onSelectTown(rec.id)}
                          className="font-semibold hover:underline underline-offset-2"
                          style={{ color: 'var(--navy)' }}
                        >
                          {rec.name}
                        </button>
                      </>
                    )}
                    {!item.town && <span className="uppercase tracking-wide">statewide</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
