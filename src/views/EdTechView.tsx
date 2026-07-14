import { useEffect, useMemo, useState } from 'react'
import { normalizeDistrictKey, type EdTechAction } from '../geo'
import { fmtDate } from '../model'

/** District EdTech usage listing — deliberately a listing, not a rating.
 *  Data: public/data/edtech-services.json (see scripts/merge_edtech.py). */

type SourcedItem = { name: string; category?: string; source?: string }
type Commentary = { who: string; what: string; date?: string; source?: string }
type Contract = { vendor: string; detail: string; source?: string }

type EdTechDistrict = {
  districtName: string
  districtId?: string | null
  oneToOne: {
    exists: boolean | null
    grades?: string | null
    device?: string | null
    takeHome?: string | null
    source?: string | null
  }
  lms: string[]
  aiPolicy: { exists: boolean | null; summary?: string | null; source?: string | null }
  aiPilot: boolean
  aiPilotNote?: string | null
  aiTools?: { name: string; audience?: string; source?: string }[]
  notableServices: SourcedItem[]
  dpaRegistry: { found: boolean; url?: string | null; note?: string | null; approxApproved?: number | null }
  contracts?: Contract[]
  publicCommentary?: Commentary[]
  sources?: string[]
}

type EdTechData = { _lastUpdated: string; _notes: string; districts: EdTechDistrict[] }
type EdTechActionsData = { _lastUpdated: string; byTown: Record<string, EdTechAction[]> }
type NextMeetingEntry = {
  next_meeting: string | null
  additional_upcoming?: string[]
  checked: string
  source_url: string
  status: 'ok' | 'no_future_date' | 'fetch_failed'
}
type NextMeetingsData = { _lastUpdated: string; byKey: Record<string, NextMeetingEntry> }

type SortKey = 'name' | 'services' | 'agreements' | 'actions'

export function EdTechView({ onBackToMap }: { onBackToMap?: () => void }) {
  const [data, setData] = useState<EdTechData | null>(null)
  const [actionsData, setActionsData] = useState<EdTechActionsData | null>(null)
  const [meetingsData, setMeetingsData] = useState<NextMeetingsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/edtech-services.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<EdTechData>
      })
      .then(setData)
      .catch((e) => setError(String(e)))
    fetch(`${import.meta.env.BASE_URL}data/edtech-actions.json`)
      .then((r) => (r.ok ? (r.json() as Promise<EdTechActionsData>) : null))
      .then(setActionsData)
      .catch(() => setActionsData(null))
    fetch(`${import.meta.env.BASE_URL}data/next-school-committee-meetings.json`)
      .then((r) => (r.ok ? (r.json() as Promise<NextMeetingsData>) : null))
      .then(setMeetingsData)
      .catch(() => setMeetingsData(null))
  }, [])

  // districtName (normalized) -> next meeting, same join key model.ts uses.
  const meetingByDistrict = useMemo(() => {
    const m = new Map<string, NextMeetingEntry>()
    if (!meetingsData) return m
    for (const d of data?.districts ?? []) {
      const entry = meetingsData.byKey[normalizeDistrictKey(d.districtName)]
      if (entry) m.set(d.districtName, entry)
    }
    return m
  }, [data, meetingsData])

  // districtId -> actions, flattened across the town-keyed source file.
  const actionsByDistrict = useMemo(() => {
    const m = new Map<string, EdTechAction[]>()
    for (const list of Object.values(actionsData?.byTown ?? {})) {
      for (const a of list) {
        if (!a.districtId) continue
        const arr = m.get(a.districtId) ?? []
        arr.push(a)
        m.set(a.districtId, arr)
      }
    }
    return m
  }, [actionsData])

  const rows = useMemo(() => {
    if (!data) return []
    const val = (d: EdTechDistrict): string | number => {
      switch (sort.key) {
        case 'name':
          return d.districtName
        case 'services':
          return d.notableServices.length
        case 'agreements':
          return d.dpaRegistry.approxApproved ?? -1
        case 'actions':
          return (d.districtId && actionsByDistrict.get(d.districtId)?.length) || 0
      }
    }
    return [...data.districts].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const cmp =
        typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return cmp !== 0 ? cmp * sort.dir : a.districtName.localeCompare(b.districtName)
    })
  }, [data, sort, actionsByDistrict])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }))

  if (error)
    return (
      <div className="absolute inset-0 flex items-center justify-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
        Couldn’t load EdTech data ({error}).
      </div>
    )

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[1100px] mx-auto px-4 py-4 flex flex-col gap-3">
        {onBackToMap && (
          <div
            className="inline-flex self-start rounded-lg border shadow-sm overflow-hidden"
            style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
            role="tablist"
            aria-label="EdTech format"
          >
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={onBackToMap}
              className="px-3 h-8 text-[12px] font-semibold border-r hover:bg-black/[.05]"
              style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
            >
              Map
            </button>
            <button
              type="button"
              role="tab"
              aria-selected
              className="px-3 h-8 text-[12px] font-semibold"
              style={{ color: '#fff', background: 'var(--navy)' }}
            >
              Table
            </button>
          </div>
        )}
        <p className="m-0 text-[12.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>
          What each district runs in the classroom — 1:1 devices, platforms, AI tools, and signed
          student-data-privacy agreements. A listing, not a rating: a signed agreement means a tool was
          vetted for use, not that it’s deployed. Click a district for detail.
          {data && (
            <span style={{ color: 'var(--ink-3)' }}> Updated {data._lastUpdated}.</span>
          )}
        </p>

        <section
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
        >
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 720 }}>
              <thead>
                <tr
                  className="sticky top-0 z-10"
                  style={{ background: 'var(--card)', boxShadow: 'inset 0 -1px var(--hairline)' }}
                >
                  <Th onClick={() => toggleSort('name')} active={sort.key === 'name'} dir={sort.dir} w="21%">
                    District
                  </Th>
                  <Th w="22%">1:1 devices</Th>
                  <Th w="17%">AI</Th>
                  <Th onClick={() => toggleSort('services')} active={sort.key === 'services'} dir={sort.dir} w="15%">
                    Services
                  </Th>
                  <Th
                    onClick={() => toggleSort('agreements')}
                    active={sort.key === 'agreements'}
                    dir={sort.dir}
                    w="12%"
                  >
                    Privacy&nbsp;DPAs
                  </Th>
                  <Th onClick={() => toggleSort('actions')} active={sort.key === 'actions'} dir={sort.dir} w="13%">
                    Actions
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <DistrictRows
                    key={d.districtName}
                    d={d}
                    actions={(d.districtId && actionsByDistrict.get(d.districtId)) || []}
                    meeting={meetingByDistrict.get(d.districtName) ?? null}
                    open={open === d.districtName}
                    onToggle={() => setOpen(open === d.districtName ? null : d.districtName)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!data && !error && (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
              Loading…
            </div>
          )}
        </section>

        {data && (
          <p className="m-0 text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
            Sources: district technology pages, student handbooks, school-committee minutes, budget
            documents, local press, and the{' '}
            <a href="https://sdpc.a4l.org/view_alliance.php?state=MA" target="_blank" rel="noreferrer" style={{ color: 'var(--ink-2)' }}>
              MA Student Privacy Alliance registry
            </a>
            . Coverage is currently the MA-4 area; more districts as they’re researched.
          </p>
        )}
      </div>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
  w,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  dir?: 1 | -1
  w?: string
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-left"
      style={{ color: 'var(--ink-3)', width: w }}
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

function DistrictRows({
  d,
  actions,
  meeting,
  open,
  onToggle,
}: {
  d: EdTechDistrict
  actions: EdTechAction[]
  meeting: NextMeetingEntry | null
  open: boolean
  onToggle: () => void
}) {
  const aiBits: string[] = []
  if (d.aiPilot) aiBits.push('State AI pilot')
  if (d.aiPolicy.exists) aiBits.push('District guidelines')
  if (d.aiTools && d.aiTools.length > 0) aiBits.push(`${d.aiTools.length} tool${d.aiTools.length > 1 ? 's' : ''}`)
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer align-top"
        style={{
          boxShadow: 'inset 0 -1px var(--hairline)',
          background: open ? '#0f213714' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = ''
        }}
      >
        <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--ink)' }}>
          <span aria-hidden className="inline-block w-4 text-[10px]" style={{ color: 'var(--ink-3)' }}>
            {open ? '▾' : '▸'}
          </span>
          {d.districtName.replace(/ (Public )?Schools?( District)?$/i, '')}
        </td>
        <td className="px-3 py-2.5" style={{ color: 'var(--ink-2)' }}>
          {d.oneToOne.exists ? (
            <span>
              {shortDevice(d.oneToOne.device)}
              {d.oneToOne.grades ? `, ${shortGrades(d.oneToOne.grades)}` : ''}
            </span>
          ) : d.oneToOne.exists === false ? (
            <span style={{ color: 'var(--ink-3)' }}>none found</span>
          ) : (
            <span style={{ color: 'var(--ink-3)' }}>not documented</span>
          )}
        </td>
        <td className="px-3 py-2.5" style={{ color: 'var(--ink-2)' }}>
          {aiBits.length > 0 ? aiBits.join(' · ') : <span style={{ color: 'var(--ink-3)' }}>—</span>}
        </td>
        <td className="px-3 py-2.5 tnum" style={{ color: 'var(--ink-2)' }}>
          {d.notableServices.length} notable
        </td>
        <td className="px-3 py-2.5 tnum" style={{ color: 'var(--ink-2)' }}>
          {d.dpaRegistry.approxApproved != null ? `~${d.dpaRegistry.approxApproved}` : d.dpaRegistry.found ? 'listed' : '—'}
        </td>
        <td className="px-3 py-2.5 tnum" style={{ color: actions.length > 0 ? 'var(--ink-2)' : 'var(--ink-3)' }}>
          {actions.length > 0 ? actions.length : '—'}
        </td>
      </tr>
      {open && (
        <tr style={{ boxShadow: 'inset 0 -1px var(--hairline)' }}>
          <td colSpan={6} className="px-4 pb-4 pt-1" style={{ background: 'rgba(0,0,0,0.015)' }}>
            <Detail d={d} actions={actions} meeting={meeting} />
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({
  d,
  actions,
  meeting,
}: {
  d: EdTechDistrict
  actions: EdTechAction[]
  meeting: NextMeetingEntry | null
}) {
  const byCat = useMemo(() => {
    const m = new Map<string, SourcedItem[]>()
    for (const s of d.notableServices) {
      const cat = (s.category ?? 'other').split('(')[0].split('—')[0].split(';')[0].trim().toLowerCase()
      const key = cat.includes('monitor') || cat.includes('filter')
        ? 'monitoring & filtering'
        : cat.includes('gamif') || cat.includes('adaptive')
          ? 'adaptive & gamified'
          : cat.includes('assess')
            ? 'assessment'
            : cat.includes('commun')
              ? 'communication'
              : 'other platforms'
      const arr = m.get(key) ?? []
      arr.push(s)
      m.set(key, arr)
    }
    return m
  }, [d.notableServices])

  return (
    <div className="flex flex-col gap-3 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
      {meeting && (
        <Block label="Next school committee meeting">
          {meeting.next_meeting ? (
            <span className="tnum">{fmtDate(meeting.next_meeting)}</span>
          ) : (
            <span style={{ color: 'var(--ink-3)' }}>No upcoming date found</span>
          )}
          {meeting.source_url && (
            <>
              {' '}
              <a
                href={meeting.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px]"
                style={{ color: 'var(--ink-3)' }}
              >
                [meeting calendar]
              </a>
            </>
          )}
        </Block>
      )}
      {d.oneToOne.exists && (
        <Block label="1:1 program">
          {[d.oneToOne.device, d.oneToOne.grades, d.oneToOne.takeHome ? `take-home: ${clip(d.oneToOne.takeHome, 120)}` : null]
            .filter(Boolean)
            .join(' · ')}
          <SourceLink url={d.oneToOne.source} />
        </Block>
      )}
      {d.lms.length > 0 && <Block label="Core platforms">{d.lms.join(' · ')}</Block>}
      {(d.aiPolicy.exists || d.aiPilot || (d.aiTools?.length ?? 0) > 0) && (
        <Block label="AI">
          {d.aiPilot && <div>In the state PLTW AI-curriculum pilot.</div>}
          {d.aiPolicy.exists && (
            <div>
              {clip(d.aiPolicy.summary ?? 'District guidelines exist.', 320)}
              <SourceLink url={d.aiPolicy.source} />
            </div>
          )}
          {d.aiTools && d.aiTools.length > 0 && (
            <div>
              Tools: {d.aiTools.map((t) => t.name + (t.audience ? ` (${clip(t.audience, 40)})` : '')).join(' · ')}
            </div>
          )}
        </Block>
      )}
      {[...byCat.entries()].map(([cat, items]) => (
        <Block key={cat} label={cat}>
          {items.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              {s.source ? (
                <a href={s.source} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-2)' }}>
                  {s.name}
                </a>
              ) : (
                s.name
              )}
            </span>
          ))}
        </Block>
      ))}
      {d.contracts && d.contracts.length > 0 && (
        <Block label="Contracts & spending">
          <ul className="m-0 pl-4 flex flex-col gap-1">
            {d.contracts.map((c) => (
              <li key={c.vendor + c.detail.slice(0, 20)}>
                <strong style={{ color: 'var(--ink)' }}>{c.vendor}</strong> — {clip(c.detail, 220)}
                <SourceLink url={c.source} />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {d.publicCommentary && d.publicCommentary.length > 0 && (
        <Block label="Public commentary">
          <ul className="m-0 pl-4 flex flex-col gap-1">
            {d.publicCommentary.map((c) => (
              <li key={c.who + (c.date ?? '')}>
                <strong style={{ color: 'var(--ink)' }}>{c.who}</strong>
                {c.date ? ` (${c.date})` : ''}: {clip(c.what, 260)}
                <SourceLink url={c.source} />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {actions.length > 0 && (
        <Block label="Actions against EdTech">
          <ul className="m-0 pl-4 flex flex-col gap-1">
            {actions.map((a, i) => (
              <li key={i}>
                <strong style={{ color: 'var(--ink)' }}>
                  {[a.actor.name, a.actor.body].filter(Boolean).join(', ') || a.kind}
                </strong>
                {a.date ? ` (${a.date})` : ''}: {clip(a.what, 260)}
                <SourceLink url={a.sources[0]?.url} />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {d.dpaRegistry.found && d.dpaRegistry.url && (
        <Block label="Privacy agreements">
          {d.dpaRegistry.approxApproved != null ? `~${d.dpaRegistry.approxApproved} approved tools on file. ` : ''}
          <a href={d.dpaRegistry.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-2)' }}>
            Full vendor registry →
          </a>
        </Block>
      )}
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div className="leading-snug">{children}</div>
    </div>
  )
}

function SourceLink({ url }: { url?: string | null }) {
  if (!url) return null
  return (
    <>
      {' '}
      <a href={url} target="_blank" rel="noreferrer" className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
        [source]
      </a>
    </>
  )
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}

/** "Grades 6-12 confirmed: all Sharon Middle School…" → "Grades 6-12 confirmed".
 *  Splits on "(" and ";" only — a ":" would break "1:1". */
function shortGrades(g: string): string {
  const cut = g.split(/[(;]/)[0].trim().replace(/[,:]$/, '')
  return cut.length > 40 ? cut.slice(0, 39).trimEnd() + '…' : cut
}

/** Long research prose → compact device label; full text lives in the expanded row. */
function shortDevice(dev?: string | null): string {
  if (!dev) return 'Devices'
  let cut = dev.split(/[;—]/)[0].trim()
  if (cut.length > 60) cut = cut.slice(0, 59).trimEnd() + '…'
  // Never leave an unclosed paren fragment ("Chromebook (3-year lease…").
  let depth = 0
  let openIdx = -1
  for (let i = 0; i < cut.length; i++) {
    if (cut[i] === '(') {
      if (depth === 0) openIdx = i
      depth++
    } else if (cut[i] === ')') depth--
  }
  if (depth > 0 && openIdx >= 0) cut = cut.slice(0, openIdx).trim().replace(/[,–-]$/, '')
  return cut || 'Devices'
}
