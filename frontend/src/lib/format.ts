import type { FeatureDef } from './types';

export function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lon).toFixed(3)}° ${ew}`;
}

export function isValidCoord(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function fmtValue(v: number | null | undefined, def?: Pick<FeatureDef, 'unit' | 'key'>): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'unavailable';
  const unit = def?.unit ?? '';
  if (unit.startsWith('degrees')) return `${v.toFixed(1)}°`;
  if (unit === 'm') return `${v >= 100 ? v.toFixed(0) : v.toFixed(2)} m`;
  if (def?.key === 'hypsometric_integral') return v.toFixed(3);
  return v.toFixed(3);
}

export const KIND_LABEL: Record<string, string> = {
  target: 'Planetary reference',
  earth_named: 'Named analog site',
  earth_survey: 'Survey grid cell',
};

export const COORD_STATUS: Record<string, { label: string; tone: string; help: string }> = {
  approximate_unverified: {
    label: 'approximate coordinates',
    tone: 'bg-amber-500/15 text-amber-300',
    help: 'Site coordinates were supplied by the project authors from public knowledge and could not be verified against a gazetteer. Terrain values at this point are real DEM measurements.',
  },
  algorithmic_grid: {
    label: 'grid cell',
    tone: 'bg-sky-500/15 text-sky-300',
    help: 'Coordinates generated on a regular latitude/longitude grid inside a documented survey region.',
  },
  derived_from_source_metadata: {
    label: 'from source metadata',
    tone: 'bg-emerald-500/15 text-emerald-300',
    help: 'Centre taken from the STAC metadata of the source DTM.',
  },
  derived_from_source_metadata_adjusted: {
    label: 'from source metadata (shifted)',
    tone: 'bg-emerald-500/15 text-emerald-300',
    help: 'Centre taken from the STAC metadata of the source DTM, shifted to the nearest fully covered 12 km window.',
  },
};

/** Sequential colour (dark blue -> cyan -> pale yellow) for a 0-100 similarity index. */
export function indexColor(s: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [49, 54, 149]],
    [40, [69, 117, 180]],
    [60, [116, 173, 209]],
    [75, [171, 217, 233]],
    [90, [254, 224, 144]],
    [100, [253, 174, 97]],
  ];
  const x = Math.max(0, Math.min(100, s));
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i];
    const [x0, c0] = stops[i - 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const c = c0.map((v, k) => Math.round(v + t * (c1[k] - v)));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return 'rgb(253, 174, 97)';
}

export const SERIES_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6'];
