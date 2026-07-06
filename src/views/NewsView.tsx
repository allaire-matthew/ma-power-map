import { useMemo } from 'react'
import type { World, NewsItem } from '../model'
import { fmtDate } from '../model'

type Cluster = {
  title: string
  url: string
  date: string | null
  sources: string[]
  town: string | null
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'as', 'at', 'is',
  'are', 'with', 'after', 'over', 'its', 'his', 'her', 'their', 'how', 'why',
  'what', 'mass', 'massachusetts', 'state',
])

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )
}

function similar(a: Set<string>, b: Set<string>): boolean {
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  return inter / Math.min(a.size || 1, b.size || 1) >= 0.6
}

/** Same-story items from different outlets fold into one row. */
function clusterItems(items: NewsItem[]): Cluster[] {
  const clusters: (Cluster & { toks: Set<string> })[] = []
  for (const it of items) {
    const toks = tokens(it.title)
    const hit = clusters.find((c) => similar(c.toks, toks))
    if (hit) {
      if (!hit.sources.includes(it.source)) hit.sources.push(it.source)
      continue
    }
    clusters.push({
      title: it.title,
      url: it.url,
      date: it.date,
      sources: [it.source],
      town: it.town,
      toks,
    })
  }
  return clusters
}

export function NewsView({
  world,
  onSelectTown,
}: {
  world: World
  onSelectTown: (id: string) => void
}) {
  const { statewide, byTown } = useMemo(() => {
    const all = [...(world.news?.items ?? [])].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? ''),
    )
    const statewide = clusterItems(all.filter((i) => !i.town))
    const local = clusterItems(all.filter((i) => i.town))
    const byTown = new Map<string, Cluster[]>()
    for (const c of local) {
      const list = byTown.get(c.town!) ?? []
      if (list.length < 3) list.push(c)
      byTown.set(c.town!, list)
    }
    return { statewide, byTown }
  }, [world.news])

  const townEntries = useMemo(
    () =>
      [...byTown.entries()]
        .map(([key, clusters]) => ({ key, clusters, rec: world.byKey.get(key) }))
        .filter((t) => t.rec)
        .sort((a, b) => (b.clusters[0]?.date ?? '').localeCompare(a.clusters[0]?.date ?? '')),
    [byTown, world.byKey],
  )

  if (!world.news) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          No news yet — the daily refresh writes data/news.json.
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[720px] mx-auto px-4 py-5 flex flex-col gap-6">
        <section>
          <SectionHead
            title="Massachusetts"
            right={world.news._lastUpdated ? `updated ${fmtDate(world.news._lastUpdated)}` : undefined}
          />
          <ul className="m-0 p-0 list-none flex flex-col">
            {statewide.map((c) => (
              <ClusterRow key={c.url} c={c} />
            ))}
          </ul>
          {statewide.length === 0 && <Empty />}
        </section>

        <section>
          <SectionHead title="Chapter & group towns" />
          <div className="flex flex-col gap-4">
            {townEntries.map(({ key, clusters, rec }) => (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => onSelectTown(rec!.id)}
                  className="text-[12px] font-semibold uppercase tracking-wide hover:underline underline-offset-2"
                  style={{ color: 'var(--navy)' }}
                >
                  {rec!.name}
                </button>
                <ul className="m-0 p-0 list-none flex flex-col">
                  {clusters.map((c) => (
                    <ClusterRow key={c.url} c={c} />
                  ))}
                </ul>
              </div>
            ))}
            {townEntries.length === 0 && <Empty />}
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHead({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="m-0 text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
        {title}
      </h2>
      {right && (
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {right}
        </span>
      )}
    </div>
  )
}

function ClusterRow({ c }: { c: Cluster }) {
  return (
    <li className="py-2 flex flex-col gap-0.5" style={{ boxShadow: 'inset 0 -1px var(--hairline)' }}>
      <a
        href={c.url}
        target="_blank"
        rel="noreferrer"
        className="text-[13.5px] font-semibold leading-snug hover:underline underline-offset-2"
        style={{ color: 'var(--ink)' }}
      >
        {c.title}
      </a>
      <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        {c.sources.slice(0, 3).join(' · ')} · {fmtDate(c.date)}
      </span>
    </li>
  )
}

function Empty() {
  return (
    <div className="py-6 text-center text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
      Nothing in the current window.
    </div>
  )
}
