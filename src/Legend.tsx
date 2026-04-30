import type { LayerState } from './LayerToggles'
import { TIER_COLOR, TIER_LABEL } from './MapBackground'

export function Legend({ layers }: { layers: LayerState }) {
  const showPhone = layers.phoneFree
  const showSize = layers.sizeGradient
  const showCong = layers.congressional
  const showLeg = layers.stateLegislature
  const showSchool = layers.schoolDistricts

  if (!showPhone && !showSize && !showCong && !showLeg && !showSchool) return null

  return (
    <aside
      data-map-ui
      className="absolute right-3 top-3 z-20 w-60 bg-white/95 backdrop-blur border border-slate-200 rounded-md shadow-lg text-[12px] text-slate-700"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
          Legend
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          live
        </span>
      </div>

      <div className="p-3 space-y-3">
        {showPhone && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Phone-free status
            </div>
            <ul className="space-y-1">
              {[3, 2, 1].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-slate-300"
                    style={{ background: TIER_COLOR[t as 1 | 2 | 3] }}
                  />
                  <span className="leading-tight">
                    {TIER_LABEL[t as 1 | 2 | 3]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              Districts not yet researched default to tier 1, lighter shade.
            </div>
          </div>
        )}

        {showSize && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Size gradient
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 flex-1 rounded-sm border border-slate-300"
                style={{
                  background:
                    'linear-gradient(to right, rgba(100,116,139,0.15), rgba(100,116,139,0.85))',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>smaller</span>
              <span>larger</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              avg(area, enrollment); falls back to area only when enrollment unknown.
            </div>
          </div>
        )}

        {showCong && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              US House
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#7c3aed"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              </svg>
              <span>District boundary</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-4 h-4 rounded-full border border-purple-600 bg-white text-[10px] font-bold text-purple-700 flex items-center justify-center">
                #
              </span>
              <span>District number (outside MA)</span>
            </div>
          </div>
        )}

        {showLeg && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              State legislature
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#0ea5e9"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              </svg>
              <span>MA House</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#dc2626"
                  strokeWidth="1.4"
                  strokeDasharray="6 3"
                />
              </svg>
              <span>MA Senate</span>
            </div>
          </div>
        )}

        {showSchool && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              School districts
            </div>
            <div className="flex items-center gap-2">
              <svg width="32" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="#ca8a04"
                  strokeWidth="1.2"
                  strokeDasharray="5 2 1 2"
                />
              </svg>
              <span>District boundary</span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">
          Click any town for details. Hover for the town name.
        </div>
      </div>
    </aside>
  )
}
