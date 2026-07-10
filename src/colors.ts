import type { PhoneTier } from './geo'

// Single source of truth for every data encoding (DESIGN.md D1).
// All ramps validated with the dataviz palette validator on 2026-07-03
// against the map surface #f7f6f3 (ordinal mode) — see DESIGN.md D3.

// Phone-policy tier — ordinal single-hue green ramp, darker = stronger
// policy. Tier 1 is "no district policy": semantically nothing, so it
// reads as near-surface neutral rather than a ramp step. Replaces the
// old red→green traffic light (deuteranopia-unsafe); every tier is
// always labeled wherever the color appears (DESIGN.md D2).
export const TIER_COLOR: Record<PhoneTier, string> = {
  1: '#e7e5df',
  2: '#6cbc7d',
  3: '#2f9e4f',
  4: '#0b6e33',
}

// Chip-friendly ink for each tier (dark enough to read as text).
export const TIER_INK: Record<PhoneTier, string> = {
  1: '#8a877f',
  2: '#2e7c42',
  3: '#20713a',
  4: '#0b6e33',
}

export const TIER_LABEL: Record<PhoneTier, string> = {
  1: 'Tier 1 — No district policy',
  2: 'Tier 2 — Partial / accessible storage',
  3: 'Tier 3 — Inaccessible storage, scope-limited',
  4: 'Tier 4 — Bell-to-bell, inaccessible storage, K-12',
}

export const TIER_SHORT: Record<PhoneTier, string> = {
  1: 'Tier 1 · no policy',
  2: 'Tier 2 · partial',
  3: 'Tier 3 · stored',
  4: 'Tier 4 · bell-to-bell',
}

// Parent-organizing presence — violet, one channel, everywhere.
export const PRESENCE = '#7c3aed'

// Boundary strokes (recessive; DESIGN.md B2).
export const BOUNDARY = {
  town: { stroke: '#c9c6bd', width: 0.55 },
  county: { stroke: '#57544e', width: 1.3 },
  school: { stroke: '#a08a3c', width: 0.9, dash: '5 2 1 2' },
  congressional: { stroke: '#7c3aed', width: 1.2, dash: '4 3' },
  stateSenate: { stroke: '#b0483f', width: 1.0, dash: '6 3' },
  stateHouse: { stroke: '#3a7ca5', width: 0.7, dash: '2 2' },
}
