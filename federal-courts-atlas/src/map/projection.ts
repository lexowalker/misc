// Composite projection for the atlas: Albers USA for the lower 48 plus framed insets
// for Alaska, Hawaii, Puerto Rico + U.S. Virgin Islands, Guam and the Northern
// Mariana Islands, arranged in a tidy cluster at the bottom-left like a newspaper map.
//
// Why not d3-composite-projections' geoAlbersUsaTerritories? Verified (v2.0.0): it
// places PR/VI at the bottom-right by Florida and Guam/NMI mid-left off California, at
// 1x scale (Guam ~10px), with no frames. The brief wants tidy bottom-left insets and
// legible territories, so each region here gets its own projection fitted to a box.
//
// Rendering routes each feature to its region's projection (by state postal code)
// instead of multiplexing every geometry through every projection. That is cheaper
// (one projection per feature) and cannot leak one region's geometry into another's box.

import { geoAlbers, geoConicEqualArea, geoPath, type GeoPath, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo';

export const VIEW_W = 975;
export const VIEW_H = 610;

export type RegionId = 'lower48' | 'ak' | 'hi' | 'prvi' | 'gu' | 'mp';
export type Box = [[number, number], [number, number]];

export interface Region {
  id: RegionId;
  /** Inset label, small caps. Empty for the lower 48. */
  label: string;
  projection: GeoProjection;
  /** Inset frame in viewBox units; null for the lower 48. */
  box: Box | null;
  /** Where the inset label sits (top-left of frame by default). */
  labelAt?: [number, number];
}

interface RegionSpec {
  id: Exclude<RegionId, 'lower48'>;
  label: string;
  make: () => GeoProjection;
  /** lon/lat bounds to fit: [[west, south], [east, north]] (west may be < -180 to cross the antimeridian). */
  bounds: [[number, number], [number, number]];
  box: Box;
  pad: number;
}

// Inset cluster, viewBox units. The lower 48 (Albers, scale 1300) leaves this area free:
// below y~440 for x<200, below y~460 for x<300, below y~525 for x<400.
const SPECS: RegionSpec[] = [
  {
    id: 'ak',
    label: 'Alaska',
    make: () => geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]),
    bounds: [[-188, 51.2], [-129.9, 71.45]],
    box: [[6, 470], [178, 604]],
    pad: 6,
  },
  {
    id: 'hi',
    label: 'Hawaii',
    make: () => geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]),
    bounds: [[-160.3, 18.86], [-154.75, 22.3]],
    box: [[184, 470], [292, 536]],
    pad: 6,
  },
  {
    id: 'gu',
    label: 'Guam',
    make: () => geoConicEqualArea().rotate([-144.8, 0]).center([0, 13.45]).parallels([10, 16]),
    bounds: [[144.6, 13.22], [145.0, 13.68]],
    box: [[184, 542], [228, 604]],
    pad: 7,
  },
  {
    id: 'mp',
    label: 'N. Mariana Is.',
    make: () => geoConicEqualArea().rotate([-145.6, 0]).center([0, 17.3]).parallels([14, 20]),
    bounds: [[144.85, 14.08], [146.1, 20.58]],
    box: [[234, 542], [270, 604]],
    pad: 5,
  },
  {
    id: 'prvi',
    label: 'P.R. & V.I.',
    make: () => geoConicEqualArea().rotate([66, 0]).center([0, 18]).parallels([8, 18]),
    bounds: [[-67.95, 17.62], [-64.55, 18.56]],
    box: [[276, 542], [392, 604]],
    pad: 7,
  },
];

const LABEL_ROW = 15;

const STATE_REGION: Record<string, RegionId> = { AK: 'ak', HI: 'hi', PR: 'prvi', VI: 'prvi', GU: 'gu', MP: 'mp' };

/** Densified outline of a lon/lat box, as a MultiPoint (winding-agnostic for fitExtent). */
function outline([[w, s], [e, n]]: [[number, number], [number, number]]): GeoPermissibleObjects {
  const pts: [number, number][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = w + (e - w) * t;
    const lat = s + (n - s) * t;
    pts.push([lon, s], [lon, n], [w, lat], [e, lat]);
  }
  return { type: 'MultiPoint', coordinates: pts };
}

export interface AtlasProjection {
  regions: Region[];
  byId: Record<RegionId, Region>;
  /** Region for a state/territory postal code; null for places without a district (e.g. AS). */
  regionOfState(postal: string | undefined | null): Region | null;
  regionOfLonLat(lon: number, lat: number): Region | null;
  /** Project a point; uses the state's region when known. */
  project(lon: number, lat: number, state?: string | null): [number, number] | null;
  /** geoPath for a region (with optional digits for compact path strings). */
  path(region: RegionId): GeoPath;
}

let shared: AtlasProjection | null = null;

/** The atlas projection is fixed (viewBox units), so one shared instance serves every map. */
export function atlasProjection(): AtlasProjection {
  if (shared) return shared;
  const lower48: Region = {
    id: 'lower48',
    label: '',
    // precision(0): no adaptive resampling. The topology is already simplified for each
    // zoom level, so resampling would only add points and time.
    projection: geoAlbers().scale(1300).translate([487.5, 305]).precision(0),
    box: null,
  };
  const regions: Region[] = [lower48];
  for (const spec of SPECS) {
    const [[x0, y0], [x1, y1]] = spec.box;
    const p = spec
      .make()
      // Leave a label row (LABEL_ROW units) at the top of each frame for the inset name.
      .fitExtent([[x0 + spec.pad, y0 + Math.max(spec.pad, LABEL_ROW)], [x1 - spec.pad, y1 - spec.pad]], outline(spec.bounds))
      .clipExtent(spec.box)
      .precision(0);
    regions.push({ id: spec.id, label: spec.label, projection: p, box: spec.box, labelAt: [x0, y0 - 4] });
  }
  const byId = Object.fromEntries(regions.map((r) => [r.id, r])) as Record<RegionId, Region>;
  const paths = new Map<RegionId, GeoPath>();

  const regionOfLonLat = (lon: number, lat: number): Region | null => {
    if (lat > 50 && (lon < -129 || lon > 170)) return byId.ak;
    if (lat > 18 && lat < 23 && lon > -161 && lon < -154) return byId.hi;
    if (lat > 17 && lat < 19 && lon > -68.5 && lon < -64) return byId.prvi;
    if (lat > 13 && lat < 13.9 && lon > 144 && lon < 145.2) return byId.gu;
    if (lat >= 13.9 && lat < 21 && lon > 144.5 && lon < 146.5) return byId.mp;
    if (lat < -10 && lon < -168) return null; // American Samoa: no federal district court
    if (lat > 24 && lat < 50 && lon > -125.5 && lon < -66) return lower48;
    return null;
  };

  shared = {
    regions,
    byId,
    regionOfState: (postal) => {
      if (!postal) return null;
      const p = postal.toUpperCase();
      if (p === 'AS') return null;
      return byId[STATE_REGION[p] ?? 'lower48'];
    },
    regionOfLonLat,
    project(lon, lat, state) {
      const r = (state ? this.regionOfState(state) : null) ?? regionOfLonLat(lon, lat);
      if (!r) return null;
      const xy = r.projection([lon, lat]);
      if (!xy) return null;
      if (r.box) {
        const [[x0, y0], [x1, y1]] = r.box;
        if (xy[0] < x0 || xy[0] > x1 || xy[1] < y0 || xy[1] > y1) return null;
      }
      return xy;
    },
    path(region) {
      let p = paths.get(region);
      if (!p) {
        p = geoPath(byId[region].projection).digits(2);
        paths.set(region, p);
      }
      return p;
    },
  };
  return shared;
}
