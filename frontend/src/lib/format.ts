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
    tone: 'bg-warn-soft text-warn ring-1 ring-inset ring-warn/20',
    help: 'Site coordinates were supplied by the project authors from public knowledge and could not be verified against a gazetteer. Terrain values at this point are real DEM measurements.',
  },
  algorithmic_grid: {
    label: 'grid cell',
    tone: 'bg-moon/10 text-moon ring-1 ring-inset ring-moon/20',
    help: 'Coordinates generated on a regular latitude/longitude grid inside a documented survey region.',
  },
  derived_from_source_metadata: {
    label: 'from source metadata',
    tone: 'bg-earth/10 text-earth ring-1 ring-inset ring-earth/20',
    help: 'Centre taken from the STAC metadata of the source DTM.',
  },
  derived_from_source_metadata_adjusted: {
    label: 'from source metadata (shifted)',
    tone: 'bg-earth/10 text-earth ring-1 ring-inset ring-earth/20',
    help: 'Centre taken from the STAC metadata of the source DTM, shifted to the nearest fully covered 12 km window.',
  },
};

/**
 * Sequential colour for a 0-100 similarity index: one hue, light to dark.
 *
 * A single teal ramp (not a rainbow) so the scale reads as a quantity on the
 * light surface, with more ink meaning more similarity. Lightness is
 * monotonic, so the ordering survives greyscale printing and colour-vision
 * deficiency. Markers carry a dark hairline stroke, which keeps the pale low
 * end visible against the basemap.
 */
export function indexColor(s: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [222, 240, 236]],
    [40, [168, 216, 207]],
    [60, [108, 190, 176]],
    [75, [46, 159, 142]],
    [90, [0, 125, 106]],
    [100, [0, 84, 72]],
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
  return 'rgb(0, 84, 72)';
}

/**
 * Categorical series colours, in fixed assignment order: the planetary
 * reference first, then candidates. Four slots is the maximum the app can
 * show (one reference plus at most three compared candidates), so the order
 * is never cycled.
 *
 * Validated for the light chart surface with the data-viz palette checker:
 * lightness band, chroma floor, CVD separation and contrast all pass across
 * every pair, not just adjacent ones (worst case dE 10.4 protan).
 */
export const SERIES_COLORS = ['#009b84', '#eb6834', '#2a78d6', '#5b21b6'];
