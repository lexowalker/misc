// Topology -> projected geometry (SVG path strings, centroids, bounds) for the atlas
// map, thumbnails and locator maps. Results are cached per topology object.

import { feature, mesh } from 'topojson-client';
import { geoPath, geoStream, type GeoStream } from 'd3-geo';
import type { Feature, Geometry, MultiLineString } from 'geojson';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { AtlasTopology, DistrictProps } from '../data/types.ts';
import { loadTopology } from '../data/loaders.ts';
import { registryDistrict, DISTRICTS, FIPS_STATE } from '../data/districts.ts';
import { atlasProjection, type RegionId } from './projection.ts';

export interface DistrictShape {
  id: string;
  name: string;
  short: string;
  state: string;
  circuit: string;
  region: RegionId;
  d: string;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
  /** Projected area in viewBox units^2 (for label/priority decisions). */
  area: number;
  /** False for dev-fallback state shapes that do not correspond to one district. */
  navigable: boolean;
}

export interface AtlasGeometry {
  kind: 'districts' | 'dev-states';
  resolution: 'lo' | 'hi';
  districts: DistrictShape[];
  byId: Map<string, DistrictShape>;
  /** Interior district borders (excludes coastlines). */
  districtMesh: string;
  /** Interior state borders. */
  stateMesh: string;
  /** County lines (hi only). */
  countyMesh: string;
  /** State outlines as individual shapes (for locator context). */
  states: Array<{ id: string; d: string; region: RegionId; bounds: [[number, number], [number, number]] }>;
  topology: Topology;
}

const cache = new WeakMap<object, AtlasGeometry>();

/** Planar path generator for already-projected coordinates (viewBox units). */
const PLANAR = geoPath(null).digits(2);

/**
 * Project a GeoJSON geometry into planar viewBox coordinates with a region's
 * projection (including its inset clipping), as MultiPolygon / MultiLineString.
 */
export function projectGeometry(g: Geometry, region: RegionId): Geometry | null {
  const polys: number[][][][] = [];
  const lines: number[][][] = [];
  let ring: number[][] | null = null;
  let poly: number[][][] | null = null;
  let inPolygon = false;
  const sink: GeoStream = {
    point(x, y) {
      ring?.push([x, y]);
    },
    lineStart() {
      ring = [];
    },
    lineEnd() {
      if (!ring) return;
      if (inPolygon) {
        if (ring.length > 2) {
          ring.push(ring[0]!);
          poly!.push(ring);
        }
      } else if (ring.length > 1) lines.push(ring);
      ring = null;
    },
    polygonStart() {
      inPolygon = true;
      poly = [];
    },
    polygonEnd() {
      inPolygon = false;
      if (poly?.length) polys.push(poly);
      poly = null;
    },
    sphere() {},
  };
  geoStream(g, atlasProjection().byId[region].projection.stream(sink));
  if (polys.length) return { type: 'MultiPolygon', coordinates: polys };
  if (lines.length) return { type: 'MultiLineString', coordinates: lines };
  return null;
}

type AnyGeom = GeometryObject<Record<string, unknown>>;

function stateOfDistrictFeature(f: { id?: string | number; properties?: DistrictProps | null }): string | undefined {
  return f.properties?.state ?? (f.id !== undefined ? registryDistrict(String(f.id))?.state : undefined);
}

function stateOfCounty(g: AnyGeom): string | undefined {
  const props = (g.properties ?? {}) as Record<string, unknown>;
  const did = typeof props.district_id === 'string' ? props.district_id : undefined;
  if (did) return registryDistrict(did)?.state;
  const geoid = g.id !== undefined ? String(g.id).padStart(5, '0') : '';
  return FIPS_STATE[geoid.slice(0, 2)];
}

function stateOfState(g: AnyGeom): string | undefined {
  const id = g.id !== undefined ? String(g.id) : '';
  if (/^[A-Z]{2}$/.test(id)) return id;
  return FIPS_STATE[id.padStart(2, '0')];
}

/**
 * Mesh of an object's shared borders, projected region by region. The mesh is computed
 * once; each line is routed to the region of its midpoint (borders never cross regions).
 */
function regionMesh(
  topo: Topology,
  obj: GeometryCollection,
  _stateOf: (g: AnyGeom) => string | undefined,
  filter: (a: AnyGeom, b: AnyGeom) => boolean,
): string {
  const proj = atlasProjection();
  const m = mesh(topo, obj as GeometryCollection, (a: GeometryObject, b: GeometryObject) => filter(a as AnyGeom, b as AnyGeom)) as MultiLineString;
  const groups = new Map<RegionId, number[][][]>();
  for (const line of m.coordinates) {
    const mid = line[Math.floor(line.length / 2)]!;
    const r = proj.regionOfLonLat(mid[0]!, mid[1]!);
    if (!r) continue;
    (groups.get(r.id) ?? groups.set(r.id, []).get(r.id)!).push(line);
  }
  let out = '';
  for (const [rid, lines] of groups) out += proj.path(rid)({ type: 'MultiLineString', coordinates: lines }) ?? '';
  return out;
}

/** Build projected geometry from the boundaries lane's topology. */
export function buildGeometry(topo: AtlasTopology, resolution: 'lo' | 'hi'): AtlasGeometry {
  const hit = cache.get(topo);
  if (hit) return hit;
  const proj = atlasProjection();
  const t = topo as unknown as Topology;
  const fc = feature(t, topo.objects.districts as GeometryCollection<DistrictProps>);
  const districts: DistrictShape[] = [];
  for (const f of fc.features as Feature<Geometry, DistrictProps>[]) {
    const id = String(f.id ?? (f.properties as Record<string, unknown>)?.id ?? '');
    const reg = registryDistrict(id);
    const state = stateOfDistrictFeature({ id, properties: f.properties }) ?? '';
    const region = proj.regionOfState(state);
    if (!region) continue;
    // Project once, then measure the planar result (cheap) instead of re-projecting 4x.
    const planar = projectGeometry(f.geometry, region.id);
    if (!planar) continue;
    const d = PLANAR(planar) ?? '';
    if (!d) continue;
    districts.push({
      id,
      name: f.properties?.name ?? reg?.name ?? id,
      short: f.properties?.short ?? reg?.short ?? id,
      state,
      circuit: f.properties?.circuit ?? reg?.circuit ?? '',
      region: region.id,
      d,
      centroid: PLANAR.centroid(planar) as [number, number],
      bounds: PLANAR.bounds(planar) as [[number, number], [number, number]],
      area: PLANAR.area(planar),
      navigable: !!reg,
    });
  }
  // Registry order: alphabetical by state, then geographic within the state.
  districts.sort((a, b) => (registryDistrict(a.id)?.order ?? 999) - (registryDistrict(b.id)?.order ?? 999));

  const statesObj = topo.objects.states as GeometryCollection | undefined;
  // State outlines are only needed by locator maps: computed on first use.
  let states: AtlasGeometry['states'] | null = null;
  const computeStates = (): AtlasGeometry['states'] => {
    const out: AtlasGeometry['states'] = [];
    if (!statesObj) return out;
    for (const f of feature(t, statesObj).features) {
      const st = stateOfState(f as unknown as AnyGeom);
      const region = proj.regionOfState(st);
      if (!region || !st) continue;
      const planar = projectGeometry(f.geometry, region.id);
      if (!planar) continue;
      const d = PLANAR(planar) ?? '';
      if (d) out.push({ id: st, d, region: region.id, bounds: PLANAR.bounds(planar) as [[number, number], [number, number]] });
    }
    return out;
  };

  const g: AtlasGeometry = {
    kind: 'districts',
    resolution,
    districts,
    byId: new Map(districts.map((d) => [d.id, d])),
    districtMesh: regionMesh(t, topo.objects.districts as GeometryCollection, (x) => stateOfDistrictFeature(x as never), (a, b) => a !== b),
    stateMesh: statesObj ? regionMesh(t, statesObj, stateOfState, (a, b) => a !== b) : '',
    countyMesh: topo.objects.counties ? regionMesh(t, topo.objects.counties as GeometryCollection, stateOfCounty, (a, b) => a !== b) : '',
    get states() {
      return (states ??= computeStates());
    },
    topology: t,
  };
  cache.set(topo, g);
  return g;
}

/**
 * DEV ONLY: state outlines from the `us-atlas` package, used while the boundaries lane
 * has not yet written public/data/geo/districts-lo.topo.json. Never used when the real
 * topology exists, and stripped from production builds (guarded by import.meta.env.DEV).
 */
async function devFallbackGeometry(): Promise<AtlasGeometry | null> {
  if (!import.meta.env.DEV) return null;
  const mod = await import('us-atlas/states-10m.json');
  const us = (mod.default ?? mod) as unknown as Topology;
  const proj = atlasProjection();
  const statesObj = us.objects.states as GeometryCollection<{ name: string }>;
  const singleDistrict = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const d of DISTRICTS) counts.set(d.state, (counts.get(d.state) ?? 0) + 1);
  for (const d of DISTRICTS) if (counts.get(d.state) === 1) singleDistrict.set(d.state, d.id);
  const districts: DistrictShape[] = [];
  const states: AtlasGeometry['states'] = [];
  for (const f of feature(us, statesObj).features) {
    const st = FIPS_STATE[String(f.id).padStart(2, '0')];
    const region = proj.regionOfState(st);
    if (!st || !region) continue;
    const path = proj.path(region.id);
    const d = path(f) ?? '';
    if (!d) continue;
    const did = singleDistrict.get(st);
    const reg = did ? registryDistrict(did) : undefined;
    const bounds = path.bounds(f) as [[number, number], [number, number]];
    states.push({ id: st, d, region: region.id, bounds });
    districts.push({
      id: did ?? `state-${st}`,
      name: reg?.name ?? `${f.properties?.name ?? st} (state outline; districts not yet built)`,
      short: reg?.short ?? st,
      state: st,
      circuit: reg?.circuit ?? '',
      region: region.id,
      d,
      centroid: path.centroid(f) as [number, number],
      bounds,
      area: path.area(f),
      navigable: !!reg,
    });
  }
  districts.sort((a, b) => a.state.localeCompare(b.state));
  const stateMesh = regionMesh(us, statesObj as GeometryCollection, stateOfState, (a, b) => a !== b);
  return {
    kind: 'dev-states',
    resolution: 'lo',
    districts,
    byId: new Map(districts.map((d) => [d.id, d])),
    districtMesh: '',
    stateMesh,
    countyMesh: '',
    states,
    topology: us,
  };
}

export type GeometryResult =
  | { status: 'ok'; geometry: AtlasGeometry }
  | { status: 'missing' }
  | { status: 'error'; error: string };

let loPromise: Promise<GeometryResult> | null = null;
let hiPromise: Promise<GeometryResult> | null = null;

/** National-view geometry: districts-lo, or (dev only) the us-atlas state fallback. */
export function loadAtlasGeometry(): Promise<GeometryResult> {
  loPromise ??= (async () => {
    const r = await loadTopology('lo');
    performance.mark('atlas:topology-loaded');
    if (r.status === 'ok') {
      try {
        const geometry = buildGeometry(r.data, 'lo');
        performance.mark('atlas:geometry-built');
        return { status: 'ok', geometry } as const;
      } catch (e) {
        return { status: 'error', error: e instanceof Error ? e.message : String(e) } as const;
      }
    }
    if (import.meta.env.DEV && r.status === 'missing') {
      const g = await devFallbackGeometry();
      if (g) return { status: 'ok', geometry: g } as const;
    }
    return r.status === 'missing' ? ({ status: 'missing' } as const) : ({ status: 'error', error: r.error } as const);
  })();
  return loPromise;
}

/** Zoomed-in geometry (districts-hi with counties). Loaded lazily by the map. */
export function loadHiGeometry(): Promise<GeometryResult> {
  hiPromise ??= (async () => {
    const r = await loadTopology('hi');
    performance.mark('atlas:hi-topology-loaded');
    if (r.status !== 'ok') return r.status === 'missing' ? ({ status: 'missing' } as const) : ({ status: 'error', error: r.error } as const);
    try {
      const geometry = buildGeometry(r.data, 'hi');
      performance.mark('atlas:hi-geometry-built');
      return { status: 'ok', geometry } as const;
    } catch (e) {
      return { status: 'error', error: e instanceof Error ? e.message : String(e) } as const;
    }
  })();
  return hiPromise;
}
