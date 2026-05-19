export type LayerKey =
  | 'phoneFree'
  | 'sizeGradient'
  | 'counties'
  | 'congressional'
  | 'stateSenate'
  | 'stateHouse'
  | 'schoolDistricts'

export type LayerState = Record<LayerKey, boolean>

export const defaultLayers: LayerState = {
  phoneFree: true,
  sizeGradient: false,
  counties: false,
  congressional: false,
  stateSenate: false,
  stateHouse: false,
  schoolDistricts: false,
}

// Grouped so the header can render a divider between attribute layers
// (top group) and geographic layers (bottom group). Ordering inside each
// group is intentional — counties is the coarsest geo unit, school
// districts the finest.
const LABELS: { key: LayerKey; label: string; group: 'attribute' | 'geo' }[] = [
  { key: 'phoneFree', label: 'Phone-free status', group: 'attribute' },
  { key: 'sizeGradient', label: 'Size gradient', group: 'attribute' },
  { key: 'counties', label: 'Counties', group: 'geo' },
  { key: 'congressional', label: 'US House', group: 'geo' },
  { key: 'stateSenate', label: 'MA Senate', group: 'geo' },
  { key: 'stateHouse', label: 'MA House', group: 'geo' },
  { key: 'schoolDistricts', label: 'School districts', group: 'geo' },
]

export function LayerToggles({
  value,
  onChange,
}: {
  value: LayerState
  onChange: (v: LayerState) => void
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-700 whitespace-nowrap">
      {LABELS.map(({ key, label, group }, i) => {
        const prev = LABELS[i - 1]
        const isGroupStart = prev && prev.group !== group
        return (
          <span key={key} className="flex items-center gap-3">
            {isGroupStart && (
              <span
                aria-hidden
                className="inline-block w-px h-3.5 bg-slate-300"
              />
            )}
            <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
                className="accent-indigo-600"
              />
              {label}
            </label>
          </span>
        )
      })}
    </div>
  )
}
