import { geoMercator, geoPath, geoCentroid, type GeoPermissibleObjects } from 'd3-geo'
import type { Feature, FeatureCollection } from 'geojson'

export const MAP_W = 1600
export const MAP_H = 1100

export type ProjectedFeature = {
  id: string
  name: string
  d: string
  centroid: [number, number]
  population?: number
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

const FILES: Record<LayerName, string> = {
  counties: 'ma-counties.geojson',
  towns: 'ma-towns.geojson',
  congressional: 'ma-congressional.geojson',
  stateHouse: 'ma-state-house.geojson',
  stateSenate: 'ma-state-senate.geojson',
}

let projectionPromise: Promise<ReturnType<typeof geoMercator>> | null = null
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
      return geoMercator().fitSize(
        [MAP_W, MAP_H],
        counties as unknown as GeoPermissibleObjects,
      )
    })()
  }
  return projectionPromise
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
            const d = path(f as unknown as GeoPermissibleObjects) ?? ''
            const lonlat = geoCentroid(
              f as unknown as GeoPermissibleObjects,
            ) as [number, number]
            const xy = projection(lonlat) ?? [0, 0]
            const population =
              typeof props.population === 'number'
                ? (props.population as number)
                : undefined
            return {
              id,
              name,
              d,
              centroid: [xy[0], xy[1]] as [number, number],
              population,
            }
          }),
        }
      })(),
    )
  }
  return layerCache.get(name)!
}
