import {
  geoIdentity,
  geoPath,
  type GeoPermissibleObjects,
} from 'd3-geo'
import type { Feature, FeatureCollection } from 'geojson'

export const MAP_W = 1600
export const MAP_H = 1100

export type ProjectedFeature = {
  id: string
  name: string
  d: string
  centroid: [number, number]
  area: number
  population?: number
  kind?: string
}

export type ProjectedLayer = {
  features: ProjectedFeature[]
}

export type LayerName =
  | 'counties'
  | 'towns'
  | 'congressional'
  | 'stateHouse'
  | 'stateSenate'
  | 'schoolDistricts'

const FILES: Record<LayerName, string> = {
  counties: 'ma-counties.geojson',
  towns: 'ma-towns.geojson',
  congressional: 'ma-congressional.geojson',
  stateHouse: 'ma-state-house.geojson',
  stateSenate: 'ma-state-senate.geojson',
  schoolDistricts: 'ma-school-districts.geojson',
}

let projectionPromise: Promise<ReturnType<typeof geoIdentity>> | null = null
const layerCache = new Map<LayerName, Promise<ProjectedLayer>>()

function geoUrl(file: string): string {
  return `${import.meta.env.BASE_URL}geo/${file}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function getProjection() {
  if (!projectionPromise) {
    projectionPromise = (async () => {
      const counties = await fetchJson<FeatureCollection>(geoUrl(FILES.counties))
      // geoIdentity has no spherical preclip, so geoPath outputs only the
      // feature's own geometry — geoMercator was appending its clip frame
      // (M1350,0...L250,0Z) to every path. reflectY puts north up.
      return geoIdentity()
        .reflectY(true)
        .fitSize([MAP_W, MAP_H], counties as unknown as GeoPermissibleObjects)
    })()
  }
  return projectionPromise
}

export type PhoneTier = 1 | 2 | 3

export type PhonePolicy = {
  districtId: string
  districtName: string
  tier: PhoneTier
  policySummary: string
  scope: string
  enforcement: string
  effectiveDate: string
  enrollment: number | null
  sources: { title: string; url: string; publisher: string; date: string }[]
  lastVerified: string
  confidence: 'high' | 'medium' | 'low'
}

let phonePoliciesPromise: Promise<Record<string, PhonePolicy>> | null = null

export async function loadPhonePolicies(): Promise<Record<string, PhonePolicy>> {
  if (!phonePoliciesPromise) {
    phonePoliciesPromise = (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}data/phone-policies.json`
        const json = await fetchJson<{ policies: Record<string, PhonePolicy> }>(url)
        return json.policies ?? {}
      } catch {
        return {}
      }
    })()
  }
  return phonePoliciesPromise
}

export async function loadLayer(name: LayerName): Promise<ProjectedLayer> {
  if (!layerCache.has(name)) {
    layerCache.set(
      name,
      (async () => {
        const projection = await getProjection()
        const path = geoPath(projection)
        const fc = await fetchJson<FeatureCollection>(geoUrl(FILES[name]))
        return {
          features: fc.features.map((f: Feature) => {
            const props = (f.properties ?? {}) as Record<string, unknown>
            const id =
              (props.GEOID as string | undefined) ??
              (typeof f.id === 'string' || typeof f.id === 'number'
                ? String(f.id)
                : '')
            const name = (props.name as string | undefined) ?? id
            const geom = f as unknown as GeoPermissibleObjects
            const d = path(geom) ?? ''
            // path.centroid gives the projected planar centroid directly,
            // sidestepping the wrong-winding antipode issue you get with
            // geoCentroid + projection() for shapefile-sourced polygons.
            const xy = path.centroid(geom)
            const area = path.area(geom)
            const population =
              typeof props.population === 'number'
                ? (props.population as number)
                : undefined
            const kind =
              typeof props.kind === 'string' ? (props.kind as string) : undefined
            return {
              id,
              name,
              d,
              centroid: [xy[0], xy[1]] as [number, number],
              area,
              population,
              kind,
            }
          }),
        }
      })(),
    )
  }
  return layerCache.get(name)!
}
