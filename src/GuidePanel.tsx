import type { World } from './model'
import { fmtDate } from './model'
import { TIER_COLOR, TIER_LABEL } from './colors'

/**
 * The "how to read this" layer — explains the map/table encodings so
 * the uninitiated never need to decode a color or a word (DESIGN.md
 * G1, H1).
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
          A live scoreboard for Massachusetts: where parent groups are already
          organizing, and how strong each school district's phone policy is. It
          updates itself daily from public sources.
        </p>

        <section>
          <GuideHeading>Local groups</GuideHeading>
          <p className="mt-0 mb-2 text-[12.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>
            Towns with an identified parent-organizing group — a local chapter of a
            national org, or an independent group. The map's Organizing lens shows
            where they're active; the Local groups tab lists each one with its lead
            and affiliation.
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
            Policies, legislators, meeting dates, and local groups refresh daily via
            GitHub Actions.
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
