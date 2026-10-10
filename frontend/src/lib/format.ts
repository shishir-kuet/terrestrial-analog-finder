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
 * Sequential colour for a 0-100 similarity index: one teal hue, stepped for
 * the surface it is drawn on.
 *
 * The app shows this scale on both surfaces — on the light map plate and the
 * ranking chart, and on the charcoal result rows and meters. A sequential
 * ramp must move monotonically in lightness, and "away from the background"
 * is the opposite direction on each, so one ramp cannot serve both: the light
 * stepping runs pale to deep, the dark stepping runs deep to bright. Same hue,
 * same ordering, same quantity. Lightness is monotonic within each, so the
 * ordering survives greyscale and colour-vision deficiency.
 */
const RAMPS: Record<'light' | 'dark', [number, [number, number, number]][]> = {
  // Pale to deep, for the map plate and charts on paper. The pale end starts
  // a step down from white: against the basemap even this is only 1.2:1, so
  // the marker's dark outline is what makes a low-scoring point findable.
  light: [
    [0, [199, 228, 222]],
    [40, [146, 203, 192]],
    [60, [93, 178, 164]],
    [75, [36, 150, 133]],
    [90, [0, 117, 99]],
    [100, [0, 74, 63]],
  ],
  // Deep to bright, for rows and meters on charcoal.
  dark: [
    [0, [18, 48, 45]],
    [40, [16, 86, 78]],
    [60, [13, 125, 112]],
    [75, [23, 164, 146]],
    [90, [45, 212, 191]],
    [100, [148, 243, 227]],
  ],
};

export function indexColor(s: number, mode: 'light' | 'dark' = 'dark'): string {
  const stops = RAMPS[mode];
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
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

export const SERIES_COLORS = ['#009b84', '#eb6834', '#2a78d6', '#5b21b6'];
