export type LayerKey =
  | 'counties'
  | 'towns'
  | 'townLabels'
  | 'congressional'
  | 'stateHouse'
  | 'stateSenate'
  | 'irlCouncil'

export type LayerState = Record<LayerKey, boolean>

export const defaultLayers: LayerState = {
  counties: false,
  towns: true,
  townLabels: false,
  congressional: false,
  stateHouse: false,
  stateSenate: false,
  irlCouncil: false,
}

const LABELS: { key: LayerKey; label: string; depends?: LayerKey }[] = [
  { key: 'counties', label: 'Counties' },
  { key: 'towns', label: 'Towns' },
  { key: 'townLabels', label: 'Town pop.', depends: 'towns' },
  { key: 'congressional', label: 'US House' },
  { key: 'stateHouse', label: 'State House' },
  { key: 'stateSenate', label: 'State Senate' },
  { key: 'irlCouncil', label: 'IRL Council' },
]

export function LayerToggles({
  value,
  onChange,
}: {
  value: LayerState
  onChange: (v: LayerState) => void
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-700">
      {LABELS.map(({ key, label, depends }) => {
        const disabled = depends ? !value[depends] : false
        return (
          <label
            key={key}
            className={`flex items-center gap-1.5 cursor-pointer select-none ${
              disabled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={value[key] && !disabled}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              className="accent-indigo-600"
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}
