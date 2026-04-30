import {
  geoIdentity,
  geoPath,
  type GeoPermissibleObjects,
} from 'd3-geo'
import type { Feature, FeatureCollection } from 'geojson'

// (Polygon-rewind helper removed — town→district resolution no longer
// uses d3-geo's spherical methods; planar ray-cast PIP is independent
// of winding order. Rendering already worked because geoIdentity is a
// linear projection.)

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

let townToDistrictPromise: Promise<Record<string, string>> | null = null

// Planar ray-cast point-in-polygon, even-odd rule. Reliable across all
// browsers — d3-geo's spherical geoContains was returning different
// answers across runs near district boundaries, mismapping ~10% of
// towns to neighboring districts.
function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function pointInPolygon(point: [number, number], rings: number[][][]): boolean {
  if (!rings.length) return false
  // First ring is outer, subsequent are holes
  if (!pointInRing(point, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false
  }
  return true
}

function pointInGeometry(
  point: [number, number],
  geom: { type: string; coordinates: unknown },
): boolean {
  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates as number[][][])
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates as number[][][][]) {
      if (pointInPolygon(point, poly)) return true
    }
  }
  return false
}

// Build townId → districtId map by planar containment of each town's
// projected centroid against each district's projected polygons.
// Tiebreaker for towns matched by multiple districts: prefer the
// district whose name starts with the town's name (covers single-town
// districts like "Boston School District").
export async function getTownToDistrict(): Promise<Record<string, string>> {
  if (!townToDistrictPromise) {
    townToDistrictPromise = (async () => {
      const projection = await getProjection()
      const path = geoPath(projection)
      const [townsFC, districtsFC] = await Promise.all([
        fetchJson<FeatureCollection>(geoUrl(FILES.towns)),
        fetchJson<FeatureCollection>(geoUrl(FILES.schoolDistricts)),
      ])

      // Pre-project each district's polygons into planar coords.
      const projectedDistricts = districtsFC.features.map((df) => {
        const dProps = (df.properties ?? {}) as Record<string, unknown>
        const dId =
          (dProps.GEOID as string | undefined) ??
          (df.id != null ? String(df.id) : '')
        const dName = (dProps.name as string | undefined) ?? ''
        const geom = df.geometry
        let projected: { type: string; coordinates: unknown } | null = null
        if (geom?.type === 'Polygon') {
          projected = {
            type: 'Polygon',
            coordinates: (geom.coordinates as number[][][]).map((ring) =>
              ring.map((pt) => projection(pt as [number, number]) ?? [0, 0]),
            ),
          }
        } else if (geom?.type === 'MultiPolygon') {
          projected = {
            type: 'MultiPolygon',
            coordinates: (geom.coordinates as number[][][][]).map((poly) =>
              poly.map((ring) =>
                ring.map((pt) => projection(pt as [number, number]) ?? [0, 0]),
              ),
            ),
          }
        }
        return { id: dId, name: dName, geom: projected }
      })

      const map: Record<string, string> = {}
      for (const tf of townsFC.features) {
        const tProps = (tf.properties ?? {}) as Record<string, unknown>
        const tId =
          (tProps.GEOID as string | undefined) ??
          (tf.id != null ? String(tf.id) : '')
        if (!tId) continue
        const tName = (tProps.name as string | undefined) ?? ''
        const centroid = path.centroid(tf as unknown as GeoPermissibleObjects)
        const pt: [number, number] = [centroid[0], centroid[1]]

        const containers: { id: string; name: string }[] = []
        for (const d of projectedDistricts) {
          if (d.geom && d.id && pointInGeometry(pt, d.geom)) {
            containers.push({ id: d.id, name: d.name })
          }
        }
        if (!containers.length) continue
        // Prefer a district whose name starts with the town's name, e.g.
        // "Boston" → "Boston School District" wins over a regional
        // overlap. Else use the first match.
        const named = containers.find((c) =>
          c.name.toLowerCase().startsWith(tName.toLowerCase()),
        )
        map[tId] = (named ?? containers[0]).id
      }
      return map
    })()
  }
  return townToDistrictPromise
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
