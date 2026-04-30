export type LayerKey =
  | 'phoneFree'
  | 'sizeGradient'
  | 'congressional'
  | 'stateLegislature'
  | 'schoolDistricts'

export type LayerState = Record<LayerKey, boolean>

export const defaultLayers: LayerState = {
  phoneFree: true,
  sizeGradient: false,
  congressional: false,
  stateLegislature: false,
  schoolDistricts: false,
}

const LABELS: { key: LayerKey; label: string }[] = [
  { key: 'phoneFree', label: 'Phone-free status' },
  { key: 'sizeGradient', label: 'Size gradient' },
  { key: 'congressional', label: 'US House' },
  { key: 'stateLegislature', label: 'State legislature' },
  { key: 'schoolDistricts', label: 'School districts' },
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
      {LABELS.map(({ key, label }) => (
        <label
          key={key}
          className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap"
        >
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="accent-indigo-600"
          />
          {label}
        </label>
      ))}
    </div>
  )
}
