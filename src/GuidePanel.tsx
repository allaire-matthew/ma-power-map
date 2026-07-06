import type { World } from './model'
import { fmtDate } from './model'
import {
  STAGE_COLOR,
  STAGE_GATE,
  STAGE_NAME,
  STATUS,
  TIER_COLOR,
  TIER_LABEL,
} from './colors'

/**
 * The "how to read this" layer — carries the Pipeline Tracker's
 * Start Here explanations so the uninitiated never need the
 * spreadsheet to decode a color or a word (DESIGN.md G1, H1).
 */
export function GuidePanel({ world, onClose }: { world: World | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Guide"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(15,33,55,0.28)' }} />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-[400px] max-w-[92vw] overflow-y-auto thin-scroll shadow-2xl px-5 py-4 flex flex-col gap-5"
        style={{ background: 'var(--card)' }}
      >
        <div className="flex items-start justify-between">
          <h2 className="m-0 text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>
            How to read this
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="w-8 h-8 -mr-2 rounded-md flex items-center justify-center text-lg hover:bg-black/[.05]"
            style={{ color: 'var(--ink-3)' }}
          >
            ×
          </button>
        </div>

        <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          This is the live scoreboard for Commonwealth IRL's Council network: where
          Councils are and how they're progressing, where parent groups are already
          organizing, and how strong each school district's phone policy is. It updates
          itself daily from public sources; Council rows come from the Council Pipeline
          Tracker sheet.
        </p>

        <section>
          <GuideHeading>The six stages</GuideHeading>
          <p className="mt-0 mb-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            A Council advances by meeting a gate, not by time passing.
          </p>
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <li key={s} className="flex gap-2.5 items-start">
                <span
                  aria-hidden
                  className="mt-0.5 w-5 h-5 rounded-[4px] shrink-0 flex items-center justify-center text-[10.5px] font-semibold"
                  style={{ background: STAGE_COLOR[s], color: '#fff' }}
                >
                  {s}
                </span>
                <div className="text-[12.5px] leading-snug">
                  <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                    {STAGE_NAME[s]}.
                  </span>{' '}
                  <span style={{ color: 'var(--ink-2)' }}>{STAGE_GATE[s]}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <GuideHeading>The four statuses</GuideHeading>
          <p className="mt-0 mb-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Momentum — tracked separately from stage.
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {(
              [
                ['on-track', 'Meeting expectations for its current stage. No intervention needed.'],
                ['stuck', 'In the same stage longer than expected without meeting the next gate. Engage to find the blocker.'],
                ['at-risk', 'Reduced activity or reporting for 30+ days. Reach out; decide to invest, pause, or wind down.'],
                ['wound-down', 'Retired. Kept for memory; the community returns to Stage 0 for possible re-prospecting.'],
              ] as const
            ).map(([key, text]) => {
              const s = STATUS[key]
              return (
                <li key={key} className="flex gap-2.5 items-start text-[12.5px] leading-snug">
                  <span aria-hidden className="mt-[3px] text-[9px] shrink-0" style={{ color: s.dot }}>
                    {s.icon}
                  </span>
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                      {s.label}.
                    </span>{' '}
                    <span style={{ color: 'var(--ink-2)' }}>{text}</span>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 mb-0 text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
            ⚑ flags are advisory — computed from the tracker's rules of thumb (e.g.
            Stage 1 &gt; 45 days, no report in 30+ days). The Sheet's status stays the
            call of record.
          </p>
        </section>

        <section>
          <GuideHeading>Phone-policy tiers</GuideHeading>
          <p className="mt-0 mb-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Per school district, anchored to the Distraction-Free Schools spec. Darker
            green = stronger policy.
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {([1, 2, 3, 4] as const).map((t) => (
              <li key={t} className="flex gap-2.5 items-start text-[12.5px] leading-snug">
                <span
                  aria-hidden
                  className="mt-0.5 w-4 h-4 rounded-[3px] shrink-0"
                  style={{
                    background: TIER_COLOR[t],
                    border: t === 1 ? '1px solid #c9c6bd' : undefined,
                  }}
                />
                <span style={{ color: 'var(--ink-2)' }}>{TIER_LABEL[t]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <GuideHeading>Where the data comes from</GuideHeading>
          <ul className="m-0 mt-1 p-0 list-none flex flex-col gap-1">
            {(world?.freshness ?? []).map((f) => (
              <li key={f.label} className="flex justify-between text-[12.5px]">
                <span style={{ color: 'var(--ink-2)' }}>{f.label}</span>
                <span className="tnum" style={{ color: 'var(--ink-3)' }}>
                  {f.date ? fmtDate(f.date) : '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
            Policies, legislators, meeting dates, and news refresh daily via GitHub
            Actions. Edits to Councils happen in the Council Pipeline Tracker sheet, not
            here.
          </p>
        </section>
      </aside>
    </div>
  )
}

function GuideHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: 'var(--ink-3)' }}
    >
      {children}
    </h3>
  )
}
