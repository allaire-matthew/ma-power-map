import { useMemo, useState } from 'react'
import type { World, TownRecord } from '../model'
import { OrgChip } from '../ui'
import { resolveOrgs } from '../orgs'

type SortKey = 'name' | 'groups'

export function GroupsView({
  world,
  selectedId,
  onSelect,
}: {
  world: World
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })

  const rows = useMemo(() => {
    const val = (r: TownRecord): string | number => {
      switch (sort.key) {
        case 'name':
          return r.name
        case 'groups':
          return r.orgs.length
      }
    }
    return [...world.tracked].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number)
      return cmp !== 0 ? cmp * sort.dir : a.name.localeCompare(b.name)
    })
  }, [world.tracked, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }))

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[1100px] mx-auto px-4 py-4 flex flex-col gap-4">
        {/* The spreadsheet. */}
        <section
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
        >
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 560 }}>
              <thead>
                <tr
                  className="sticky top-0 z-10"
                  style={{ background: 'var(--card)', boxShadow: 'inset 0 -1px var(--hairline)' }}
                >
                  <Th onClick={() => toggleSort('name')} active={sort.key === 'name'} dir={sort.dir} align="left" w="22%">
                    Town
                  </Th>
                  <Th onClick={() => toggleSort('groups')} active={sort.key === 'groups'} dir={sort.dir} align="left" w="56%">
                    Group(s)
                  </Th>
                  <Th align="left" w="22%">Lead</Th>
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
              No local groups on file yet.
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
  const rawLead = rec.orgs.find((o) => o.leadName)?.leadName ?? null
  const leadParts = rawLead?.split('/').map((x) => x.trim()).filter(Boolean) ?? []
  const lead = leadParts.length > 1 ? `${leadParts[0]} +${leadParts.length - 1}` : rawLead
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
          {rec.name}
        </div>
        <div className="text-[11.5px] leading-tight" style={{ color: 'var(--ink-3)' }}>
          {rec.countyName ?? ''}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {rec.orgs.length > 0 ? (
          <div className="flex flex-col gap-1">
            {rec.orgs.slice(0, 3).map((o, i) => (
              <GroupCell key={i} name={groupDisplayName(o, rec.name)} orgField={o.org} chapterName={o.chapterName} />
            ))}
            {rec.orgs.length > 3 && (
              <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                +{rec.orgs.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--ink-3)' }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5" style={{ color: 'var(--ink)' }}>
        {lead ?? <span style={{ color: 'var(--ink-3)' }}>—</span>}
      </td>
    </tr>
  )
}

/** Local group identity: its own name, with the parent-org logo beside it. */
function GroupCell({
  name,
  orgField,
  chapterName,
}: {
  name: string
  orgField: string
  chapterName?: string | null
}) {
  const orgs = resolveOrgs(orgField, chapterName)
  // Don't repeat a chip whose name IS the group name shown.
  const chips = orgs.filter((o) => o.name !== name).slice(0, 2)
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate leading-tight" style={{ color: 'var(--ink)' }}>
        {name}
      </span>
      {chips.map((o) => (
        <OrgChip key={o.name} org={o} />
      ))}
    </div>
  )
}

/** chapterName is sometimes just the town ("Beverly, MA") — use the org then. */
function groupDisplayName(o: { org: string; chapterName: string | null }, townName: string): string {
  const cn = (o.chapterName ?? '').trim()
  const norm = cn.toLowerCase().replace(/,?\s*ma\.?$/, '').trim()
  if (!cn || norm === townName.toLowerCase()) return o.org.split('/')[0].trim()
  return cn
}
