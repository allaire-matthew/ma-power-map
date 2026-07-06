import type { ReactNode } from 'react'
import type { TownRecord } from './model'
import { daysSince, fmtAgo, fmtDate, healthFlags } from './model'
import { Fact, OrgChip, StageTrack, StatusChip, TierChip } from './ui'
import { resolveOrgs } from './orgs'

/**
 * Right-hand detail panel — the "details on demand" layer (DESIGN.md
 * F1/G1). Non-modal: map/table stay visible and interactive.
 */
export function DetailPanel({ rec, onClose }: { rec: TownRecord; onClose: () => void }) {
  const p = rec.pipeline
  const flags = p ? healthFlags(p) : []
  const inStage = p ? daysSince(p.dateEnteredStage) : null

  return (
    <aside
      data-map-ui
      role="complementary"
      aria-label={`${rec.name} detail`}
      className="h-full w-[340px] max-w-full flex flex-col border-l overflow-hidden"
      style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-3.5 pb-3" style={{ boxShadow: 'inset 0 -1px var(--hairline)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>
              {rec.name}
            </h2>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {[
                rec.population != null ? `${rec.population.toLocaleString()} residents` : null,
                rec.countyName ? `${rec.countyName} County` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 -mr-1.5 -mt-1 rounded-md flex items-center justify-center text-lg hover:bg-black/[.05]"
            style={{ color: 'var(--ink-3)' }}
          >
            ×
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {rec.policy && <TierChip tier={rec.policy.tier} />}
          {p && <StatusChip status={p.status} />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-4 py-3 flex flex-col gap-4">
        {/* Chapter — the headline block when present. */}
        {p && (
          <section className="flex flex-col gap-2.5">
            <SectionTitle>Council · {p.chapter}</SectionTitle>
            <StageTrack stage={p.stage} />
            {flags.length > 0 && (
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {flags.map((f) => (
                  <li key={f.text} className="text-[12px] leading-snug flex gap-1.5" style={{ color: '#8f2b1c' }}>
                    <span aria-hidden>⚑</span>
                    {f.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-1.5">
              <Fact label="Lead">
                {p.chapterLead ?? '—'}
                {p.leadConfirmed && (
                  <span className="ml-1" title="Confirmed" style={{ color: '#0ca30c' }}>
                    ✓ confirmed
                  </span>
                )}
              </Fact>
              <Fact label="Partners">
                <span className="tnum">{p.partnersCount}</span>
              </Fact>
              <Fact label="Supporters">
                <span className="tnum">{p.engagedSupporters ?? 0}</span>
              </Fact>
              <Fact label="In stage">{inStage != null ? `${inStage} days` : '—'}</Fact>
              <Fact label="Last activity">{p.lastPublicActivity ? fmtAgo(p.lastPublicActivity) : 'none yet'}</Fact>
              <Fact label="Last report">{p.lastReport ? fmtAgo(p.lastReport) : 'none yet'}</Fact>
              {p.anchorActivation && <Fact label="Anchor">{p.anchorActivation}</Fact>}
              {p.nextAction && <Fact label="Next action">{p.nextAction}</Fact>}
            </div>
            {p.notes && (
              <p className="text-[12px] leading-snug m-0" style={{ color: 'var(--ink-2)' }}>
                {p.notes}
              </p>
            )}
          </section>
        )}

        {/* Parent organizing. */}
        {rec.orgs.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>
              Local groups <Count n={rec.orgs.length} />
            </SectionTitle>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {rec.orgs.map((o, i) => {
                const infos = resolveOrgs(o.org, o.chapterName)
                return (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {infos.map((info) => (
                        <OrgChip key={info.name} org={info} showName />
                      ))}
                    </div>
                    <div className="text-[12px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                      {o.chapterName && o.chapterName !== o.org ? `${o.chapterName} — ` : ''}
                      {o.leadName ?? 'no named lead'}
                      {o.leadEmail && (
                        <>
                          {' · '}
                          <a href={`mailto:${o.leadEmail}`} className="hover:underline" style={{ color: 'var(--navy)' }}>
                            {o.leadEmail}
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Phone policy. */}
        {rec.policy && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Phone policy · {rec.policy.districtName}</SectionTitle>
            <TierChip tier={rec.policy.tier} full />
            <p
              className="text-[12px] leading-snug m-0"
              style={{
                color: 'var(--ink-2)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
              title={rec.policy.policySummary}
            >
              {rec.policy.policySummary}
            </p>
            <div className="flex flex-col gap-1.5">
              {rec.policy.effectiveDate && <Fact label="In effect">{rec.policy.effectiveDate}</Fact>}
              {rec.policy.enrollment != null && (
                <Fact label="Enrollment">
                  <span className="tnum">{rec.policy.enrollment.toLocaleString()}</span> students
                </Fact>
              )}
            </div>
            {(rec.policy.chIdxStrengths?.length || rec.policy.chIdxConcerns?.length) && (
              <details className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                <summary className="cursor-pointer font-semibold" style={{ color: 'var(--ink-2)' }}>
                  Strengths & concerns
                </summary>
                <div className="mt-1.5 flex flex-col gap-1">
                  {rec.policy.chIdxStrengths?.map((s) => (
                    <div key={s} className="flex gap-1.5">
                      <span style={{ color: '#0b6e33' }}>+</span>
                      {s}
                    </div>
                  ))}
                  {rec.policy.chIdxConcerns?.map((s) => (
                    <div key={s} className="flex gap-1.5">
                      <span style={{ color: '#8f2b1c' }}>–</span>
                      {s}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {rec.policy.sources?.[0] && (
              <a
                href={rec.policy.sources[0].url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold hover:underline underline-offset-2"
                style={{ color: 'var(--navy)' }}
              >
                Source: {rec.policy.sources[0].publisher} ↗
              </a>
            )}
          </section>
        )}

        {/* School committee. */}
        {(rec.nextMeeting || rec.schoolLink) && (
          <section className="flex flex-col gap-1.5">
            <SectionTitle>School committee</SectionTitle>
            {rec.nextMeeting?.next_meeting && (
              <Fact label="Next meeting">{fmtDate(rec.nextMeeting.next_meeting)}</Fact>
            )}
            {rec.schoolLink && (
              <a
                href={rec.schoolLink.calendar_url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold hover:underline underline-offset-2"
                style={{ color: 'var(--navy)' }}
              >
                Meeting calendar ↗
              </a>
            )}
          </section>
        )}

        {/* Representatives. */}
        {(rec.usHouse || rec.maSenate || rec.maHouse) && (
          <section className="flex flex-col gap-1.5">
            <SectionTitle>Representatives</SectionTitle>
            {rec.usHouse && (
              <Fact label="US House">
                <RepLink url={rec.usHouse.url}>
                  {rec.usHouse.name} ({rec.usHouse.party}) · MA-{rec.usHouse.district}
                </RepLink>
              </Fact>
            )}
            {rec.maSenate && (
              <Fact label="MA Senate">
                <RepLink url={rec.maSenate.url}>
                  {rec.maSenate.name} ({rec.maSenate.party})
                </RepLink>
              </Fact>
            )}
            {rec.maHouse && (
              <Fact label="MA House">
                <RepLink url={rec.maHouse.url}>
                  {rec.maHouse.name} ({rec.maHouse.party})
                </RepLink>
              </Fact>
            )}
          </section>
        )}

      </div>
    </aside>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      className="m-0 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: 'var(--ink-3)' }}
    >
      {children}
    </h3>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span className="tnum normal-case tracking-normal" style={{ color: 'var(--ink-3)' }}>
      · {n}
    </span>
  )
}

function RepLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="hover:underline underline-offset-2"
      style={{ color: 'var(--ink)' }}
    >
      {children}
    </a>
  )
}
