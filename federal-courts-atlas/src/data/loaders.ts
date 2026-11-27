// Typed loaders for every file in docs/DATA_CONTRACT.md. All return Loaded<T>
// (ok | missing | error) and never throw. Shapes are normalized here so that a
// small format change by a producing lane is absorbed in one place.

import { loadJson, mapLoaded } from './fetch.ts';
import type {
  AtlasTopology,
  Case,
  CasesFile,
  Courthouse,
  DataManifest,
  District,
  DistrictGeography,
  DistrictJudgesFile,
  DistrictProfile,
  DivisionRecord,
  DivisionsFile,
  Judge,
  Loaded,
  SearchEntry,
  SearchIndex,
  SourceRecord,
  SourcesFile,
  ValuesFile,
  Variable,
} from './types.ts';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function asArray<T>(v: unknown, ...keys: string[]): T[] {
  if (Array.isArray(v)) return v as T[];
  if (isObj(v)) {
    for (const k of keys) if (Array.isArray(v[k])) return v[k] as T[];
  }
  throw new Error('expected an array');
}

/* ---- web lane files ---------------------------------------------------- */

export const loadManifest = (): Promise<Loaded<DataManifest>> => loadJson<DataManifest>('manifest.json');

export const loadVariables = (): Promise<Loaded<Variable[]>> =>
  mapLoaded(loadJson<unknown>('variables.json'), (raw) =>
    asArray<Variable>(raw, 'variables').filter((v) => v && typeof v.id === 'string'),
  );

export const loadValues = (variableId: string): Promise<Loaded<ValuesFile>> =>
  mapLoaded(loadJson<ValuesFile>(`values/${encodeURIComponent(variableId)}.json`), (raw) => {
    if (!isObj(raw) || !isObj((raw as unknown as Json).values)) throw new Error('values file has no "values" object');
    const years =
      Array.isArray(raw.years) && raw.years.length
        ? raw.years.map(Number).sort((a, b) => a - b)
        : collectYears(raw.values);
    return { ...raw, years };
  });

function collectYears(values: ValuesFile['values']): number[] {
  const set = new Set<number>();
  for (const byYear of Object.values(values)) for (const y of Object.keys(byYear ?? {})) set.add(Number(y));
  return [...set].filter(Number.isFinite).sort((a, b) => a - b);
}

export const loadDistricts = (): Promise<Loaded<Record<string, District>>> =>
  mapLoaded(loadJson<unknown>('districts.json'), (raw) => {
    if (isObj(raw) && !Array.isArray(raw.districts)) {
      const first = Object.values(raw)[0];
      if (isObj(first) && 'name' in first) {
        return Object.fromEntries(Object.entries(raw).map(([id, d]) => [id, { id, ...(d as Json) } as District]));
      }
    }
    const list = asArray<District>(raw, 'districts');
    return Object.fromEntries(list.map((d) => [d.id, d]));
  });

/** judges.json, grouped by district_id. */
export const loadJudges = (): Promise<Loaded<Record<string, Judge[]>>> =>
  mapLoaded(loadJson<unknown>('judges.json'), (raw) => {
    const out: Record<string, Judge[]> = {};
    if (isObj(raw) && !Array.isArray(raw.judges)) {
      for (const [id, list] of Object.entries(raw)) {
        if (Array.isArray(list)) out[id] = (list as Judge[]).map((j) => ({ ...j, district_id: j.district_id ?? id }));
      }
      if (Object.keys(out).length) return out;
    }
    for (const j of asArray<Judge>(raw, 'judges')) (out[j.district_id] ??= []).push(j);
    return out;
  });

export const loadCases = (districtId: string): Promise<Loaded<CasesFile>> =>
  mapLoaded(loadJson<unknown>(`cases/${encodeURIComponent(districtId)}.json`), (raw) => {
    if (Array.isArray(raw)) return { district_id: districtId, items: raw as Case[] };
    const r = raw as Json;
    const items = asArray<Case>(r, 'items', 'cases', 'results');
    return { ...(r as object), district_id: (r.district_id as string) ?? districtId, items } as CasesFile;
  });

/** judges/<district>.json: one district's FJC records (smaller than judges.json; same records). */
export const loadDistrictJudges = (districtId: string): Promise<Loaded<DistrictJudgesFile>> =>
  mapLoaded(loadJson<unknown>(`judges/${encodeURIComponent(districtId)}.json`), (raw) => {
    if (Array.isArray(raw)) return { district_id: districtId, source_ids: [], judges: raw as Judge[] };
    const r = raw as Json;
    const judges = asArray<Judge>(r, 'judges').map((j) => ({ ...j, district_id: j.district_id ?? districtId }));
    return { ...(r as object), district_id: (r.district_id as string) ?? districtId, source_ids: (r.source_ids as string[]) ?? [], judges } as DistrictJudgesFile;
  });

/** profiles/<district>.json: distinctive paragraph (with claims), key stats and case mix. */
export const loadProfile = (districtId: string): Promise<Loaded<DistrictProfile>> =>
  mapLoaded(loadJson<DistrictProfile>(`profiles/${encodeURIComponent(districtId)}.json`), (raw) => {
    if (!isObj(raw) || !isObj((raw as unknown as Json).distinctive)) throw new Error('profile has no "distinctive" block');
    return { ...raw, key_stats: Array.isArray(raw.key_stats) ? raw.key_stats : [] };
  });

export const loadSources = (): Promise<Loaded<SourcesFile>> =>
  mapLoaded(loadJson<unknown>('sources.json'), (raw) => {
    if (Array.isArray(raw)) {
      return Object.fromEntries((raw as Array<SourceRecord & { id?: string; source_id?: string }>).map((s) => [s.source_id ?? s.id ?? s.url, s]));
    }
    const r = raw as Json;
    return (isObj(r.sources) ? r.sources : r) as SourcesFile;
  });

/* ---- geo (boundaries lane) ---------------------------------------------- */

export const loadTopology = (res: 'lo' | 'hi'): Promise<Loaded<AtlasTopology>> =>
  mapLoaded(loadJson<AtlasTopology>(`geo/districts-${res}.topo.json`), (t) => {
    if (!t || t.type !== 'Topology' || !t.objects?.districts) throw new Error('not an atlas topology');
    return t;
  });

/**
 * divisions.json. Current shape (boundaries lane):
 *   {source, source_ids, districts: {id: {name, statute_sections, has_statutory_divisions,
 *    divisions: [{name, ordinal, statute_section, counties: [{geoid, name}], places_of_holding_court}],
 *    counties, places_of_holding_court, notes}}}
 * Older/alternative shapes ([{district_id, name, counties}] or {id: [divisions]}) are also accepted.
 */
export const loadDivisions = (): Promise<Loaded<DivisionsFile>> =>
  mapLoaded(loadJson<unknown>('geo/divisions.json'), (raw) => {
    const out: DivisionsFile = { source_ids: [], districts: {} };
    const ensure = (id: string): DistrictGeography =>
      (out.districts[id] ??= { district_id: id, statute_sections: [], has_statutory_divisions: false, divisions: [], counties: [], places_of_holding_court: [] });
    if (isObj(raw) && isObj(raw.districts)) {
      out.source = typeof raw.source === 'string' ? raw.source : undefined;
      out.source_ids = Array.isArray(raw.source_ids) ? (raw.source_ids as string[]) : [];
      for (const [id, rec] of Object.entries(raw.districts as Record<string, Json>)) {
        const g = ensure(id);
        g.name = typeof rec.name === 'string' ? rec.name : undefined;
        g.statute_sections = Array.isArray(rec.statute_sections) ? (rec.statute_sections as string[]) : [];
        g.divisions = Array.isArray(rec.divisions) ? (rec.divisions as Json[]).map((d) => normDivision({ district_id: id, ...d })) : [];
        g.has_statutory_divisions = typeof rec.has_statutory_divisions === 'boolean' ? rec.has_statutory_divisions : g.divisions.length > 0;
        g.counties = Array.isArray(rec.counties)
          ? (rec.counties as unknown[]).map((c) => (isObj(c) ? { geoid: String(c.geoid ?? ''), name: String(c.name ?? c.geoid ?? '') } : { geoid: String(c), name: String(c) }))
          : [];
        g.places_of_holding_court = Array.isArray(rec.places_of_holding_court) ? (rec.places_of_holding_court as string[]) : [];
        g.notes = (rec.notes as string | string[] | undefined) ?? undefined;
      }
      return out;
    }
    const list: DivisionRecord[] = [];
    if (isObj(raw) && !Array.isArray(raw.divisions)) {
      for (const [district_id, l] of Object.entries(raw)) if (Array.isArray(l)) for (const d of l as Json[]) list.push(normDivision({ district_id, ...d }));
    } else {
      list.push(...asArray<Json>(raw, 'divisions').map(normDivision));
    }
    for (const d of list) {
      const g = ensure(d.district_id);
      g.divisions.push(d);
      g.has_statutory_divisions = true;
    }
    return out;
  });

function normDivision(d: Json): DivisionRecord {
  const places = d.places_of_holding_court ?? d.places;
  return {
    district_id: String(d.district_id ?? ''),
    name: String(d.name ?? d.division ?? ''),
    counties: Array.isArray(d.counties)
      ? (d.counties as unknown[]).map((c) => (isObj(c) ? String(c.name ?? c.geoid ?? '') : String(c)))
      : [],
    statute_section: d.statute_section ? String(d.statute_section) : undefined,
    places: Array.isArray(places) ? (places as string[]) : undefined,
    ordinal: typeof d.ordinal === 'number' ? d.ordinal : undefined,
    sentence: typeof d.sentence === 'string' ? d.sentence : undefined,
  };
}

/* ---- places of holding court (courthouses lane) ------------------------- */

export const loadCourthouses = (): Promise<Loaded<Courthouse[]>> =>
  mapLoaded(loadJson<unknown>('geo/courthouses.json'), (raw) =>
    asArray<Courthouse>(raw, 'courthouses', 'features', 'items')
      .map((c) => ({ ...c, lat: Number(c.lat), lon: Number(c.lon) }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && !!c.district_id),
  );

/* ---- search index (courthouses lane; format defined there) -------------- */

export function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Normalize any reasonable search-file shape into SearchEntry[]. Supported:
 *  - [{label|name|city|county|zip, kind|type, district_id|district|district_ids, state}]
 *  - {entries|items|records: [...]}
 *  - {"22314": "vaed"} or {"22314": ["vaed", ...]} maps (kind inferred from the file name)
 *  - {zips: {...}, cities: [...], counties: [...], courthouses: [...]} bundles
 */
export function normalizeSearch(raw: unknown, file: string): SearchEntry[] {
  const inferredKind = /zip/i.test(file) ? 'zip' : /count/i.test(file) ? 'county' : /cit|place/i.test(file) ? 'city' : /court/i.test(file) ? 'courthouse' : '';
  const out: SearchEntry[] = [];
  const push = (rec: Json, kindHint: string) => {
    const ids = (Array.isArray(rec.district_ids) ? rec.district_ids : Array.isArray(rec.districts) ? rec.districts : [rec.district_id ?? rec.district])
      .filter(Boolean)
      .map(String);
    if (!ids.length) return;
    const kind = String(rec.kind ?? rec.type ?? kindHint ?? '') || 'place';
    const base = String(rec.label ?? rec.name ?? rec.display ?? rec.city ?? rec.county ?? rec.zip ?? rec.zcta ?? rec.q ?? '');
    if (!base) return;
    const state = rec.state ? String(rec.state) : undefined;
    const label = state && !base.includes(',') && kind !== 'zip' ? `${base}, ${state}` : base;
    out.push({
      label,
      kind,
      district_id: ids[0]!,
      district_ids: ids.length > 1 ? ids : undefined,
      state,
      detail: rec.detail ? String(rec.detail) : rec.address ? String(rec.address) : undefined,
      lat: typeof rec.lat === 'number' ? rec.lat : undefined,
      lon: typeof rec.lon === 'number' ? rec.lon : typeof rec.lng === 'number' ? rec.lng : undefined,
      key: foldKey(`${label} ${rec.aliases ?? ''} ${rec.city ?? ''} ${rec.county ?? ''}`),
    });
  };
  const walk = (v: unknown, kindHint: string) => {
    if (Array.isArray(v)) {
      for (const r of v) if (isObj(r)) push(r, kindHint);
      return;
    }
    if (!isObj(v)) return;
    for (const k of ['entries', 'items', 'records', 'results']) {
      if (Array.isArray(v[k])) return walk(v[k], kindHint);
    }
    const bundleKeys = Object.keys(v).filter((k) => /^(zips?|zctas?|cit(y|ies)|places?|count(y|ies)|courthouses?)$/i.test(k));
    if (bundleKeys.length) {
      for (const k of bundleKeys) {
        const hint = /zip|zcta/i.test(k) ? 'zip' : /count/i.test(k) ? 'county' : /court/i.test(k) ? 'courthouse' : 'city';
        walk(v[k], hint);
      }
      return;
    }
    // Plain lookup map: key -> district id(s) or record.
    for (const [key, val] of Object.entries(v)) {
      if (typeof val === 'string' || Array.isArray(val)) {
        const ids = (Array.isArray(val) ? val : [val]).map(String);
        push({ label: key, district_ids: ids }, kindHint || (/^\d{5}$/.test(key) ? 'zip' : 'place'));
      } else if (isObj(val)) {
        push({ label: key, ...val }, kindHint);
      }
    }
  };
  walk(raw, inferredKind);
  return out;
}

const SEARCH_CANDIDATES = [
  'search/index.json',
  'search/search-index.json',
  'search/places.json',
  'search/cities.json',
  'search/counties.json',
  'search/zips.json',
  'search/zcta.json',
  'search/courthouses.json',
  'search-index.json',
];

let searchPromise: Promise<Loaded<SearchIndex>> | null = null;

/** Loads whichever search files exist and merges them into one index. */
export function loadSearchIndex(): Promise<Loaded<SearchIndex>> {
  if (searchPromise) return searchPromise;
  searchPromise = (async () => {
    const results = await Promise.all(SEARCH_CANDIDATES.map((p) => loadJson<unknown>(p).then((r) => [p, r] as const)));
    const entries: SearchEntry[] = [];
    const files: string[] = [];
    let firstUrl = '';
    for (const [path, r] of results) {
      if (r.status !== 'ok') continue;
      firstUrl ||= r.url;
      files.push(path);
      try {
        entries.push(...normalizeSearch(r.data, path));
      } catch {
        /* skip malformed file; others may still work */
      }
    }
    // Courthouses double as search entries even before a dedicated index exists.
    const ch = await loadCourthouses();
    if (ch.status === 'ok') {
      files.push('geo/courthouses.json');
      for (const c of ch.data) {
        const label = c.name ? c.name : `${c.city}, ${c.state}`;
        entries.push({
          label,
          kind: 'courthouse',
          district_id: c.district_id,
          state: c.state,
          detail: c.name ? `${c.city}, ${c.state}` : c.kind.replace(/_/g, ' '),
          lat: c.lat,
          lon: c.lon,
          key: foldKey(`${label} ${c.city} ${c.state} ${c.address ?? ''}`),
        });
      }
    }
    if (!files.length) return { status: 'missing', url: SEARCH_CANDIDATES[0]! } as const;
    return { status: 'ok', url: firstUrl, data: { entries, files } } as const;
  })();
  return searchPromise;
}

/* ---- accessors ---------------------------------------------------------- */

export function getValue(file: ValuesFile | null | undefined, districtId: string, year: number | null | undefined): number | null {
  if (!file || year === null || year === undefined) return null;
  const v = file.values[districtId]?.[String(year)];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Ranks may be keyed district->year or year->district; accept either. */
export function getRank(file: ValuesFile | null | undefined, districtId: string, year: number | null | undefined): number | null {
  if (!file?.ranks || year === null || year === undefined) return null;
  const a = file.ranks[districtId]?.[String(year)];
  if (typeof a === 'number') return a;
  const b = file.ranks[String(year)]?.[districtId];
  return typeof b === 'number' ? b : null;
}

/** Number of districts with a value in a year (the "of N" in "12th of 94"). */
export function rankedCount(file: ValuesFile | null | undefined, year: number | null | undefined): number | null {
  if (!file || year === null || year === undefined) return null;
  const declared = file.ranked_of?.[String(year)];
  if (typeof declared === 'number') return declared;
  let n = 0;
  for (const id of Object.keys(file.values)) if (getValue(file, id, year) !== null) n += 1;
  return n || null;
}

export function latestYear(file: ValuesFile | null | undefined): number | null {
  if (!file?.years?.length) return null;
  return file.years[file.years.length - 1]!;
}

/** Published national figure for a year, or null. */
export function getNational(file: ValuesFile | null | undefined, year: number | null | undefined): number | null {
  if (!file?.national || year === null || year === undefined) return null;
  const v = file.national[String(year)];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Caveat text attached to one district-year cell (source caveat, small base, approximate population). */
export function getCellNote(file: ValuesFile | null | undefined, districtId: string, year: number | null | undefined): string | null {
  if (!file?.cell_notes || year === null || year === undefined) return null;
  return file.cell_notes[districtId]?.[String(year)] ?? null;
}

/** Source ids behind one cell: its own entry in cell_sources, else the year's default. */
export function getCellSources(file: ValuesFile | null | undefined, districtId: string, year: number | null | undefined): string[] {
  if (!file || year === null || year === undefined) return [];
  return file.cell_sources?.[districtId]?.[String(year)] ?? file.source_by_year?.[String(year)] ?? [];
}

/** Whether one cell is derived (whole variable derived, a derived year, or a listed derived cell). */
export function isDerivedCell(file: ValuesFile | null | undefined, districtId: string, year: number | null | undefined): boolean {
  if (!file || year === null || year === undefined) return false;
  if (file.derived) return true;
  if (file.derived_years?.includes(year)) return true;
  return !!file.derived_cells?.[districtId]?.includes(String(year));
}

export function caveatList(v: Variable | null | undefined): string[] {
  if (!v?.caveats) return [];
  return Array.isArray(v.caveats) ? v.caveats : [v.caveats];
}
