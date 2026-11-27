// "Find your federal court": an in-memory index over the courthouses lane's search
// files (public/data/search/*.json; shapes in docs/lanes/courthouses.md) plus the
// district registry. Rows are arrays with a `fields` header. Nothing here is a
// statistic: it maps places, counties, ZIP codes (Census ZCTAs) and courthouses to
// districts, keeping every district a place reaches into (primary first).

import { loadJson } from './fetch.ts';
import { foldKey } from './loaders.ts';
import { DISTRICTS, STATE_FIPS } from './districts.ts';
import type { Loaded } from './types.ts';

export type PlaceKind = 'city' | 'county' | 'zip' | 'courthouse' | 'district' | 'state';

export interface PlaceDistrict {
  id: string;
  /** 'primary' (contains the place's point, the county's statutory district, or the ZIP's largest share). */
  role: 'primary' | 'also';
  /** Share of a ZIP code's land area in this district (0-1), from the Census relationship file. */
  share?: number;
}

export interface PlaceHit {
  kind: PlaceKind;
  /** Display name without the state: "Alexandria", "Fairfax County", "22314". */
  name: string;
  /** Postal code, when the hit is in one state. */
  state?: string;
  /** Extra line, e.g. the city of a courthouse building. */
  detail?: string;
  /** Census place type for cities: c incorporated, p CDP, m town/township/borough, i island area. */
  placeType?: string;
  districts: PlaceDistrict[];
  /** Census internal point (cities; courthouse buildings take their city's point). */
  lat?: number;
  lon?: number;
  /** The statute names this city as a place of holding court. */
  courtCity?: boolean;
  /** County split between districts by statute (e.g. Yellowstone, Fort Bragg, Butner). */
  splitCounty?: boolean;
  /** Unique key. */
  key: string;
  score: number;
}

interface Row {
  kind: PlaceKind;
  name: string;
  fold: string;
  state?: string;
  detail?: string;
  placeType?: string;
  districts: PlaceDistrict[];
  lat?: number;
  lon?: number;
  courtCity?: boolean;
  splitCounty?: boolean;
  /** Secondary key matched at a lower score (a courthouse's city). */
  alt?: string;
  key: string;
  /** Static tie-break bonus. */
  bonus: number;
}

export interface PlaceIndex {
  /** Search by text or ZIP digits. */
  search(query: string, limit?: number): { hits: PlaceHit[]; total: number; stateFilter?: string };
  /** What the index holds (for the help text). */
  counts: { places: number; counties: number; zips: number; courthouses: number };
  files: string[];
  /** Census point of a city, if indexed. */
  cityPoint(city: string, state: string): { lat: number; lon: number } | null;
}

type Table = { fields?: string[]; rows?: unknown[][] };

export const STATE_NAMES: Record<string, string> = Object.fromEntries(
  [...new Map(DISTRICTS.map((d) => [d.state, d.stateName])).entries()],
);
const STATE_BY_FOLDED_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [foldKey(name), code]));
const STATE_CODES = new Set(Object.keys(STATE_FIPS).filter((c) => c !== 'AS'));

const KIND_BONUS: Record<PlaceKind, number> = { state: 6, district: 4, city: 2, county: 0, courthouse: -8, zip: 0 };
const PLACE_TYPE_BONUS: Record<string, number> = { c: 1.5, m: 1, i: 1, p: 0 };

function splitIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== 'string' || !v) return [];
  return v.split(/[;,\s]+/).filter(Boolean);
}

function col(t: Table, name: string, fallback: number): number {
  const i = t.fields?.indexOf(name) ?? -1;
  return i >= 0 ? i : fallback;
}

function rowsOf(raw: unknown): Table | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Table).rows)) return null;
  return raw as Table;
}

/** "Alexandria, va" -> {q: "alexandria", state: "VA"}; "portland oregon" -> {q: "portland", state: "OR"}. */
export function parseStateSuffix(folded: string, raw: string): { q: string; state?: string } {
  const words = folded.split(' ').filter(Boolean);
  if (words.length < 2) return { q: folded };
  // Full state names, longest first ("west virginia" before "virginia").
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const tail = words.slice(-n).join(' ');
    const code = STATE_BY_FOLDED_NAME.get(tail);
    if (code) return { q: words.slice(0, -n).join(' '), state: code };
  }
  const last = words[words.length - 1]!;
  // A two-letter tail that is a postal code ("Dallas TX", "dallas, tx"). The caller falls back
  // to the whole text when the state-filtered search finds nothing.
  if (last.length === 2 && STATE_CODES.has(last.toUpperCase()) && raw.trim().length > 2) {
    return { q: words.slice(0, -1).join(' '), state: last.toUpperCase() };
  }
  return { q: folded };
}

function matchScore(key: string, q: string, words: string[]): number {
  if (!key) return 0;
  if (key === q) return 100;
  if (key.startsWith(q)) {
    // The next character after the typed text: a word break ranks above a mid-word prefix.
    const wordBreak = key.charAt(q.length) === ' ';
    return (wordBreak ? 82 : 74) - Math.min(14, (key.length - q.length) / 3);
  }
  const keyWords = key.split(' ');
  if (words.length && words.every((w) => keyWords.some((k) => k.startsWith(w)))) return 52 - Math.min(10, keyWords.length);
  if (q.length >= 3 && key.includes(q)) return 22;
  return 0;
}

function registryRows(): Row[] {
  const out: Row[] = [];
  const byState = new Map<string, string[]>();
  for (const d of DISTRICTS) {
    out.push({
      kind: 'district',
      name: d.name,
      fold: foldKey(d.name),
      alt: foldKey(`${d.short} ${d.id}`),
      state: d.state,
      districts: [{ id: d.id, role: 'primary' }],
      key: `district:${d.id}`,
      bonus: KIND_BONUS.district,
    });
    (byState.get(d.state) ?? byState.set(d.state, []).get(d.state)!).push(d.id);
  }
  for (const [state, ids] of byState) {
    const name = STATE_NAMES[state] ?? state;
    out.push({
      kind: 'state',
      name,
      fold: foldKey(name),
      state,
      districts: ids.map((id) => ({ id, role: 'primary' as const })),
      key: `state:${state}`,
      bonus: KIND_BONUS.state,
    });
  }
  return out;
}

export function buildPlaceIndex(files: { places?: unknown; counties?: unknown; zcta?: unknown; courthouses?: unknown }, found: string[] = []): PlaceIndex {
  const rows: Row[] = registryRows();
  const cityPoints = new Map<string, { lat: number; lon: number }>();
  const courtCities = new Set<string>();
  const cityKey = (city: string, state: string) => `${foldKey(city)}|${state}`;

  // Courthouses first: statute places mark "court is held here" on the matching city.
  let nCourthouses = 0;
  const ct = rowsOf(files.courthouses);
  const courthouseRows: Row[] = [];
  if (ct) {
    const iName = col(ct, 'name', 0);
    const iCity = col(ct, 'city', 1);
    const iState = col(ct, 'state', 2);
    const iDist = col(ct, 'district_id', 3);
    const iKind = col(ct, 'kind', 4);
    const iId = col(ct, 'id', 5);
    for (const r of ct.rows!) {
      const name = String(r[iName] ?? '');
      const city = String(r[iCity] ?? '');
      const state = String(r[iState] ?? '');
      const dist = String(r[iDist] ?? '');
      if (!name || !dist) continue;
      nCourthouses += 1;
      if (r[iKind] === 'p') {
        courtCities.add(cityKey(city, state));
        continue;
      }
      courthouseRows.push({
        kind: 'courthouse',
        name,
        fold: foldKey(name),
        alt: foldKey(city),
        state,
        detail: city,
        districts: [{ id: dist, role: 'primary' }],
        key: `courthouse:${String(r[iId] ?? name)}`,
        bonus: KIND_BONUS.courthouse,
      });
    }
  }

  let nPlaces = 0;
  const pl = rowsOf(files.places);
  if (pl) {
    const iName = col(pl, 'name', 0);
    const iState = col(pl, 'state', 1);
    const iLat = col(pl, 'lat', 2);
    const iLon = col(pl, 'lon', 3);
    const iDist = col(pl, 'district_id', 4);
    const iOther = col(pl, 'other_district_ids', 5);
    const iType = col(pl, 'type', 6);
    for (const r of pl.rows!) {
      const name = String(r[iName] ?? '');
      const state = String(r[iState] ?? '');
      const dist = String(r[iDist] ?? '');
      if (!name || !dist) continue;
      nPlaces += 1;
      const lat = Number(r[iLat]);
      const lon = Number(r[iLon]);
      const ck = cityKey(name, state);
      const court = courtCities.has(ck);
      const type = String(r[iType] ?? '');
      if (Number.isFinite(lat) && Number.isFinite(lon) && !cityPoints.has(ck)) cityPoints.set(ck, { lat, lon });
      const others = splitIds(r[iOther]).filter((id) => id !== dist);
      rows.push({
        kind: 'city',
        name,
        fold: foldKey(name),
        state,
        placeType: type,
        districts: [{ id: dist, role: 'primary' }, ...others.map((id) => ({ id, role: 'also' as const }))],
        lat: Number.isFinite(lat) ? lat : undefined,
        lon: Number.isFinite(lon) ? lon : undefined,
        courtCity: court,
        key: `city:${state}:${name}:${type}:${dist}`,
        // Cities where court is held rank first among places of the same name.
        bonus: KIND_BONUS.city + (PLACE_TYPE_BONUS[type] ?? 0) + (court ? 10 : 0),
      });
    }
  }
  for (const c of courthouseRows) {
    const p = cityPoints.get(cityKey(c.detail ?? '', c.state ?? ''));
    if (p) {
      c.lat = p.lat;
      c.lon = p.lon;
    }
    rows.push(c);
  }

  let nCounties = 0;
  const co = rowsOf(files.counties);
  if (co) {
    const iGeoid = col(co, 'geoid', 0);
    const iName = col(co, 'name', 1);
    const iState = col(co, 'state', 2);
    const iDist = col(co, 'district_id', 3);
    const iSplit = col(co, 'split_districts', 4);
    for (const r of co.rows!) {
      const name = String(r[iName] ?? '');
      const state = String(r[iState] ?? '');
      const dist = String(r[iDist] ?? '');
      if (!name || !dist) continue;
      nCounties += 1;
      const split = splitIds(r[iSplit]);
      const others = split.filter((id) => id !== dist);
      rows.push({
        kind: 'county',
        name,
        fold: foldKey(name),
        // "Fairfax" finds "Fairfax County" as well as the city.
        alt: foldKey(name.replace(/\b(county|parish|borough|census area|city and borough|municipality|municipio|planning region|district|island)\b/gi, '')),
        state,
        districts: [{ id: dist, role: 'primary' }, ...others.map((id) => ({ id, role: 'also' as const }))],
        splitCounty: others.length > 0,
        key: `county:${String(r[iGeoid] ?? `${state}:${name}`)}`,
        bonus: KIND_BONUS.county,
      });
    }
  }

  // ZIP codes (ZCTAs): kept as a sorted list for prefix lookups.
  const zipMap = new Map<string, PlaceDistrict[]>();
  const zt = files.zcta as { zcta?: Record<string, unknown> } | undefined;
  if (zt && typeof zt === 'object' && zt.zcta && typeof zt.zcta === 'object') {
    for (const [zip, v] of Object.entries(zt.zcta)) {
      if (typeof v === 'string') zipMap.set(zip, [{ id: v, role: 'primary' }]);
      else if (Array.isArray(v)) {
        const parts = (v as unknown[])
          .filter((p): p is [string, number] => Array.isArray(p) && typeof p[0] === 'string')
          .map(([id, share]) => ({ id, share: Number(share) }))
          .sort((a, b) => b.share - a.share);
        if (parts.length) zipMap.set(zip, parts.map((p, i) => ({ id: p.id, share: p.share, role: i === 0 ? ('primary' as const) : ('also' as const) })));
      }
    }
  }
  const zips = [...zipMap.keys()].sort();

  const toHit = (r: Row, score: number): PlaceHit => ({
    kind: r.kind,
    name: r.name,
    state: r.state,
    detail: r.detail,
    placeType: r.placeType,
    districts: r.districts,
    lat: r.lat,
    lon: r.lon,
    courtCity: r.courtCity,
    splitCounty: r.splitCounty,
    key: r.key,
    score,
  });

  const searchText = (q: string, state: string | undefined, limit: number) => {
    const words = q.split(' ').filter(Boolean);
    const scored: Array<[number, Row]> = [];
    for (const r of rows) {
      if (state && r.state !== state && r.kind !== 'state') continue;
      if (state && r.kind === 'state') continue;
      let sc = matchScore(r.fold, q, words);
      if (r.alt) sc = Math.max(sc, matchScore(r.alt, q, words) - 6);
      if (sc <= 0) continue;
      scored.push([sc + r.bonus, r]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name) || (a[1].state ?? '').localeCompare(b[1].state ?? ''));
    return { hits: scored.slice(0, limit).map(([sc, r]) => toHit(r, sc)), total: scored.length };
  };

  return {
    counts: { places: nPlaces, counties: nCounties, zips: zips.length, courthouses: nCourthouses },
    files: found,
    cityPoint(city, state) {
      return cityPoints.get(cityKey(city, state)) ?? null;
    },
    search(query, limit = 8) {
      const raw = query.trim();
      const folded = foldKey(raw);
      if (!folded) return { hits: [], total: 0 };
      const digits = raw.replace(/\s+/g, '');
      if (/^\d{1,5}$/.test(digits)) {
        if (digits.length < 3) return { hits: [], total: 0 };
        const out: PlaceHit[] = [];
        let total = 0;
        // Binary search to the first ZIP with this prefix.
        let lo = 0;
        let hi = zips.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (zips[mid]! < digits) lo = mid + 1;
          else hi = mid;
        }
        for (let i = lo; i < zips.length && zips[i]!.startsWith(digits); i++) {
          total += 1;
          if (out.length < limit) {
            const z = zips[i]!;
            out.push({ kind: 'zip', name: z, districts: zipMap.get(z)!, key: `zip:${z}`, score: z === digits ? 100 : 60 });
          }
        }
        return { hits: out, total };
      }
      const { q, state } = parseStateSuffix(folded, raw);
      if (state && q) {
        const filtered = searchText(q, state, limit);
        if (filtered.hits.length) return { ...filtered, stateFilter: state };
      }
      return searchText(folded, undefined, limit);
    },
  };
}

let indexPromise: Promise<Loaded<PlaceIndex>> | null = null;

/** Load the search files (about 2.5 MB in all) once, on first use. */
export function loadPlaceIndex(): Promise<Loaded<PlaceIndex>> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const names = ['places', 'counties', 'zcta', 'courthouses'] as const;
    const res = await Promise.all(names.map((n) => loadJson<unknown>(`search/${n}.json`)));
    const files: Record<string, unknown> = {};
    const found: string[] = [];
    let url = '';
    let error: string | null = null;
    res.forEach((r, i) => {
      if (r.status === 'ok') {
        files[names[i]!] = r.data;
        found.push(`search/${names[i]}.json`);
        url ||= r.url;
      } else if (r.status === 'error') error = r.error;
    });
    const index = buildPlaceIndex(files, found);
    if (!found.length) {
      // Registry-only search still works (states and districts); report the files as missing.
      indexPromise = null;
      if (error) return { status: 'error', url: res[0]!.url, error } as const;
      return { status: 'missing', url: res[0]!.url } as const;
    }
    return { status: 'ok', url, data: index } as const;
  })();
  return indexPromise;
}

/** Registry-only index (states and districts), always available. */
export function registryIndex(): PlaceIndex {
  return buildPlaceIndex({});
}
