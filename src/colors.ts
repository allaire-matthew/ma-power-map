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

// Chapter pipeline stage — ordinal blue ramp (stages 1–4) with two
// categorical bookends: stage 0 "Identified" is neutral (not yet a
// chapter), stage 5 "Network Hub" is CIRL gold (the summit — always
// carries its diamond badge + name, never color alone).
export const STAGE_COLOR: Record<number, string> = {
  0: '#9aa2ad',
  1: '#60a5fa',
  2: '#3b82f6',
  3: '#2563eb',
  4: '#1839a6',
  5: '#d4a843',
}

export const STAGE_NAME: Record<number, string> = {
  0: 'Identified',
  1: 'Prospecting',
  2: 'Activated',
  3: 'Programming',
  4: 'Sustained',
  5: 'Network Hub',
}

// The gate a chapter must meet to BE at each stage (Pipeline Tracker
// "Start Here" tab — surfaced in the Guide and stage tooltips).
export const STAGE_GATE: Record<number, string> = {
  0: 'A community is named as a candidate with a possible lead. No outreach yet.',
  1: 'Real conversations underway with the candidate lead; Community Assessment started.',
  2: 'Named lead + 2 partner orgs + one scheduled anchor activation.',
  3: 'Has run at least one public-facing activity; reporting to statewide has begun.',
  4: '90+ days of consistent activity, 2+ public deliverables, regular monthly reports.',
  5: 'Recruiting sub-leaders, hosting partners, helping spawn adjacent chapters.',
}

// Status (momentum) — reserved status palette, never reused for series.
// Chips always render icon + word; the color is supplementary (D2).
export type StatusKey = 'on-track' | 'stuck' | 'at-risk' | 'wound-down'

export const STATUS: Record<
  StatusKey,
  { label: string; dot: string; bg: string; ink: string; icon: string }
> = {
  'on-track': { label: 'On Track', dot: '#0ca30c', bg: '#0ca30c14', ink: '#08610a', icon: '●' },
  stuck: { label: 'Stuck', dot: '#c88a00', bg: '#fab21918', ink: '#7a5600', icon: '◆' },
  'at-risk': { label: 'At Risk', dot: '#d03b3b', bg: '#ec835a1a', ink: '#8f2b1c', icon: '▲' },
  'wound-down': { label: 'Wound Down', dot: '#898781', bg: '#8987811a', ink: '#57544e', icon: '■' },
}

export function statusKeyOf(raw: string | null | undefined): StatusKey {
  const s = (raw ?? '').trim().toLowerCase()
  if (s.startsWith('stuck')) return 'stuck'
  if (s.startsWith('at risk') || s.startsWith('at-risk')) return 'at-risk'
  if (s.startsWith('wound')) return 'wound-down'
  return 'on-track'
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
