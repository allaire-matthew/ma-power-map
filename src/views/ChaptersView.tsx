import { useMemo, useState } from 'react'
import type { World, TownRecord } from '../model'
import { daysSince, fmtAgo, healthFlags } from '../model'
import { STAGE_COLOR, STAGE_NAME } from '../colors'
import { FilterChip, OrgChip, StageTrack, StatusChip } from '../ui'
import { resolveOrgs } from '../orgs'

type SortKey = 'name' | 'stage' | 'daysInStage' | 'supporters' | 'lastActivity'
type Kind = 'all' | 'chapters' | 'prospects'

export function ChaptersView({
  world,
  selectedId,
  onSelect,
}: {
  world: World
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [kind, setKind] = useState<Kind>('all')
  const [stageFilter, setStageFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'stage', dir: -1 })

  const rows = useMemo(() => {
    let out = world.tracked
    if (kind === 'chapters') out = out.filter((r) => r.pipeline)
    if (kind === 'prospects') out = out.filter((r) => !r.pipeline)
    if (stageFilter != null) out = out.filter((r) => r.pipeline?.stage === stageFilter)
    const val = (r: TownRecord): string | number => {
      switch (sort.key) {
        case 'name':
          return r.name
        case 'stage':
          return r.pipeline ? r.pipeline.stage : -1
        case 'daysInStage':
          return r.pipeline ? daysSince(r.pipeline.dateEnteredStage) ?? -1 : -1
        case 'supporters':
          return r.pipeline?.engagedSupporters ?? -1
        case 'lastActivity':
          return r.pipeline
            ? -(daysSince(r.pipeline.lastPublicActivity ?? r.pipeline.dateEnteredStage) ?? 9999)
            : -9999
      }
    }
    return [...out].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number)
      return cmp !== 0 ? cmp * sort.dir : a.name.localeCompare(b.name)
    })
  }, [world.tracked, kind, stageFilter, sort])

  const maxStageCount = Math.max(1, ...world.stageCounts)

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }))

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[1200px] mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Stage funnel — labeled bars on a common baseline; click to
            filter the table (DESIGN.md C1/G1). */}
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
        >
          <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
            Pipeline by stage
            <span className="font-normal ml-2" style={{ color: 'var(--ink-3)' }}>
              a chapter advances by meeting a gate, not by time passing
            </span>
          </h2>
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((s) => {
              const n = world.stageCounts[s] ?? 0
              const active = stageFilter === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStageFilter(active ? null : s)}
                  aria-pressed={active}
                  className="group flex items-center gap-2 text-left rounded-md px-1.5 py-0.5 hover:bg-black/[.04]"
                >
                  <span
                    className="w-36 shrink-0 text-[12px]"
                    style={{ color: active ? 'var(--ink)' : 'var(--ink-2)', fontWeight: active ? 600 : 400 }}
                  >
                    {s} · {STAGE_NAME[s]}
                  </span>
                  <span className="flex-1 h-4 flex items-center">
                    <span
                      className="h-3.5 rounded-r-[4px] rounded-l-[1px] min-w-[2px]"
                      style={{
                        width: `${(n / maxStageCount) * 100}%`,
                        background: n > 0 ? STAGE_COLOR[s] : 'var(--hairline)',
                        opacity: stageFilter != null && !active ? 0.35 : 1,
                      }}
                    />
                    <span className="ml-2 text-[12px] font-semibold tnum" style={{ color: 'var(--ink)' }}>
                      {n}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Filters row — one row, above what it scopes (DESIGN.md G1). */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
            role="group"
            aria-label="Show"
          >
            {(
              [
                ['all', `All (${world.tracked.length})`],
                ['chapters', `Chapters (${world.kpis.chapters})`],
                ['prospects', `Prospect towns (${world.kpis.prospectTowns})`],
              ] as [Kind, string][]
            ).map(([k, label]) => {
              const active = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(k)}
                  className="px-3 h-8 text-[12.5px] font-semibold border-r last:border-r-0 hover:bg-black/[.05]"
                  style={{
                    borderColor: 'var(--hairline)',
                    color: active ? '#fff' : 'var(--ink-2)',
                    background: active ? 'var(--navy)' : 'transparent',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {stageFilter != null && (
            <FilterChip onRemove={() => setStageFilter(null)}>
              Stage {stageFilter} · {STAGE_NAME[stageFilter]}
            </FilterChip>
          )}
        </div>

        {/* The spreadsheet. */}
        <section
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
        >
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 860 }}>
              <thead>
                <tr
                  className="sticky top-0 z-10"
                  style={{ background: 'var(--card)', boxShadow: 'inset 0 -1px var(--hairline)' }}
                >
                  <Th onClick={() => toggleSort('name')} active={sort.key === 'name'} dir={sort.dir} align="left" w="16%">
                    Community
                  </Th>
                  <Th align="left" w="17%">Affiliations</Th>
                  <Th align="left" w="13%">Lead</Th>
                  <Th onClick={() => toggleSort('stage')} active={sort.key === 'stage'} dir={sort.dir} align="left" w="15%">
                    Progress
                  </Th>
                  <Th align="left" w="10%">Status</Th>
                  <Th onClick={() => toggleSort('daysInStage')} active={sort.key === 'daysInStage'} dir={sort.dir} align="right" w="7%">
                    In stage
                  </Th>
                  <Th onClick={() => toggleSort('supporters')} active={sort.key === 'supporters'} dir={sort.dir} align="right" w="8%">
                    Supporters
                  </Th>
                  <Th align="left" w="14%">Next action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.id} rec={r} selected={r.id === selectedId} onSelect={() => onSelect(r.id)} />
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--ink-2)' }}>
              No communities match.{' '}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                style={{ color: 'var(--navy)' }}
                onClick={() => {
                  setKind('all')
                  setStageFilter(null)
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
  align,
  w,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  dir?: 1 | -1
  align: 'left' | 'right'
  w?: string
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ color: 'var(--ink-3)', textAlign: align, width: w }}
      aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : undefined}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1 uppercase tracking-wide font-semibold hover:opacity-70"
          style={{ color: active ? 'var(--ink)' : 'var(--ink-3)' }}
        >
          {children}
          <span aria-hidden style={{ opacity: active ? 1 : 0.25, fontSize: 9 }}>
            {active ? (dir === 1 ? '▲' : '▼') : '▲'}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  )
}

function Row({
  rec,
  selected,
  onSelect,
}: {
  rec: TownRecord
  selected: boolean
  onSelect: () => void
}) {
  const p = rec.pipeline
  const flags = p ? healthFlags(p) : []
  const orgs = rec.orgs.flatMap((o) => resolveOrgs(o.org, o.chapterName))
  const uniqueOrgs = orgs.filter((o, i) => orgs.findIndex((x) => x.name === o.name) === i)
  const lead = p?.chapterLead ?? rec.orgs.find((o) => o.leadName)?.leadName ?? null
  const inStage = p ? daysSince(p.dateEnteredStage) : null
  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer align-middle"
      style={{
        boxShadow: 'inset 0 -1px var(--hairline)',
        background: selected ? '#0f213714' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = ''
      }}
    >
      <td className="px-3 py-2.5">
        <div className="font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
          {p?.chapter ?? rec.name}
        </div>
        <div className="text-[11.5px] leading-tight" style={{ color: 'var(--ink-3)' }}>
          {rec.countyName ? `${rec.countyName} County` : rec.name}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 flex-wrap max-w-[220px]">
          {uniqueOrgs.length > 0 ? (
            uniqueOrgs.slice(0, 3).map((o) => <OrgChip key={o.name} org={o} />)
          ) : (
            <span style={{ color: 'var(--ink-3)' }}>—</span>
          )}
          {uniqueOrgs.length > 3 && (
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              +{uniqueOrgs.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5" style={{ color: 'var(--ink)' }}>
        {lead ? (
          <span className="inline-flex items-center gap-1">
            {lead}
            {p?.leadConfirmed && (
              <span title="Lead confirmed" aria-label="Lead confirmed" style={{ color: '#0ca30c', fontSize: 11 }}>
                ✓
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-3)' }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {p ? (
          <StageTrack stage={p.stage} compact />
        ) : (
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Prospect
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {p ? (
          <span className="inline-flex items-center gap-1.5">
            <StatusChip status={p.status} />
            {flags.length > 0 && (
              <span
                title={flags.map((f) => f.text).join('\n')}
                aria-label={`${flags.length} advisory flag${flags.length > 1 ? 's' : ''}`}
                className="text-[11px] cursor-help"
                style={{ color: '#8f2b1c' }}
              >
                ⚑{flags.length}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-3)' }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tnum" style={{ color: 'var(--ink)' }}>
        {inStage != null ? `${inStage}d` : '—'}
      </td>
      <td className="px-3 py-2.5 text-right tnum" style={{ color: 'var(--ink)' }}>
        {p?.engagedSupporters ?? '—'}
      </td>
      <td className="px-3 py-2.5">
        <span className="block truncate max-w-[180px]" style={{ color: p?.nextAction ? 'var(--ink)' : 'var(--ink-3)' }}>
          {p?.nextAction ?? (p ? fmtAgo(p.lastPublicActivity) : '—')}
        </span>
      </td>
    </tr>
  )
}
