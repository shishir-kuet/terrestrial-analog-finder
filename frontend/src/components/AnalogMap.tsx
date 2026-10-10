import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Candidate, LocationSummary } from '../lib/types';
import { fmtCoord, indexColor, isValidCoord, KIND_LABEL } from '../lib/format';

// The map is a light plate inside the charcoal app, like the charts: coastlines
// and landmasses are far easier to read as geography on paper, and the markers
// still carry the data. Esri's Light Gray Canvas serves without an API key;
// CARTO's equivalent now returns a watermarked "API KEY REQUIRED" tile, so do
// not go back to it.
const TILE_URL =
  (import.meta.env.VITE_TILE_URL as string | undefined) ??
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

// Marker chrome for the light basemap.
//
// The similarity fill spans a pale-to-deep ramp, and its pale end is only
// 1.04:1 against the basemap — a fill cannot carry detectability there. So the
// dark hairline does: every ranked marker is locatable by its outline whatever
// its value, and the fill is left free to carry the number. Unranked pool
// markers have no value to show, so they take a dark fill outright (9.5:1
// against land) with a white halo, instead of the old grey at 2.16:1 that
// disappeared into the map.
const STROKE = '#1b1b19';
const STROKE_SELECTED = '#00564b';
const GRATICULE = '#8d8b82';
// Three categories, three hues, validated as a categorical set on this
// basemap: every pair clears the CVD floor (worst dE 12.4 deutan, 19.2 normal)
// and each clears 3:1 against the land. Teal is deliberately not among them —
// it is the similarity ramp, and would collide in the legend once a search
// runs. Colour is never the only cue: named sites are larger, and unranked
// ones are dashed and unfilled.
const MARKER_NAMED = '#2a78d6';     // blue
const MARKER_SURVEY = '#5b21b6';    // violet
const MARKER_EXCLUDED = '#be123c';  // rose, the reserved status hue
const POOL_HALO = '#ffffff';
const TILE_ATTR =
  (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) ??
  'Basemap: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

interface Props {
  pool: LocationSummary[];
  results: Candidate[] | null;
  excluded: Candidate[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showExcluded: boolean;
}

function Graticule() {
  const lines = useMemo(() => {
    const out: [number, number][][] = [];
    for (let lat = -60; lat <= 60; lat += 30) out.push([[lat, -180], [lat, 180]]);
    for (let lon = -180; lon <= 180; lon += 30) out.push([[-85, lon], [85, lon]]);
    return out;
  }, []);
  return (
    <>
      {lines.map((l, i) => (
        <Polyline key={i} positions={l} pathOptions={{ color: GRATICULE, weight: 1, opacity: 0.55, dashArray: '5 6' }} interactive={false} />
      ))}
    </>
  );
}

function FitTo({ points, token }: { points: [number, number][]; token: string }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!points.length || last.current === token) return;
    last.current = token;
    const lats = points.map((p) => p[0]);
    const lons = points.map((p) => p[1]);
    const b: LatLngBoundsExpression = [
      [Math.min(...lats) - 3, Math.min(...lons) - 3],
      [Math.max(...lats) + 3, Math.max(...lons) + 3],
    ];
    map.fitBounds(b, { maxZoom: 5 });
  }, [map, points, token]);
  return null;
}

function FlyToSelected({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.panTo(pos, { animate: true });
  }, [map, pos]);
  return null;
}

export function Legend({ hasResults }: { hasResults: boolean }) {
  /* The map colours markers by category before a search and by similarity
     after one, so the key has to say which is on screen rather than show both. */
  const dot = (fill: string, size: string, ring = POOL_HALO) => (
    <span aria-hidden className={`mr-1.5 inline-block ${size} shrink-0 rounded-full align-middle`}
      style={{ background: fill, boxShadow: `0 0 0 1.5px ${ring}, 0 0 0 2.5px rgb(0 0 0 / 0.18)` }} />
  );
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[1000] w-44 rounded-lg border border-line-strong bg-surface p-2.5 text-xs text-ink-muted shadow-raised sm:w-56" aria-label="Map legend">
      <p className="mb-1.5 font-semibold text-ink">Legend</p>
      {hasResults ? (
        <>
          <div className="h-2 w-full rounded" style={{ background: `linear-gradient(to right, ${[0, 40, 60, 75, 90, 100].map((v) => indexColor(v, 'light')).join(',')})` }} />
          <div className="mt-0.5 flex justify-between text-[10px] text-ink-faint">
            <span>0</span><span>similarity index</span><span>100</span>
          </div>
          <p className="mt-1.5 hidden text-[11px] leading-snug sm:block">
            Ranked markers are filled by index; named analog sites are drawn larger than survey cells.
          </p>
        </>
      ) : (
        <div className="hidden space-y-1 sm:block">
          <p className="flex items-center">{dot(MARKER_NAMED, 'h-3 w-3')} named analog site</p>
          <p className="flex items-center">{dot(MARKER_SURVEY, 'h-2.5 w-2.5')} survey grid cell</p>
        </div>
      )}
      <p className="mt-1 hidden items-center sm:flex">
        <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-dashed align-middle" style={{ borderColor: MARKER_EXCLUDED }} />
        not ranked (missing data)
      </p>
      <p className="mt-1.5 hidden text-[10px] leading-snug text-ink-faint sm:block">Markers mark the centre of a 12 km × 12 km analysis window.</p>
    </div>
  );
}


export default function AnalogMap({ pool, results, excluded, selectedId, onSelect, showExcluded }: Props) {
  const [tileState, setTileState] = useState({ loaded: 0, errors: 0 });
  const tilesFailed = tileState.errors >= 4 && tileState.loaded === 0;

  const ranked = (results ?? []).filter((r) => isValidCoord(r.lat, r.lon));
  const poolPts = pool.filter((p) => isValidCoord(p.lat, p.lon));
  const fitPts: [number, number][] = (ranked.length ? ranked : poolPts).map((p) => [p.lat, p.lon]);
  const token = ranked.length ? ranked.map((r) => r.id).join('|') : 'pool';
  const sel = ranked.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="on-light relative h-full min-h-[320px] w-full overflow-hidden rounded-lg border border-line-strong">
      <MapContainer center={[20, 0]} zoom={2} minZoom={1} worldCopyJump className="h-full w-full" aria-label="Map of Earth candidate locations">
        {!tilesFailed && (
          <TileLayer
            url={TILE_URL}
            attribution={TILE_ATTR}
            eventHandlers={{
              tileload: () => setTileState((s) => ({ ...s, loaded: s.loaded + 1 })),
              tileerror: () => setTileState((s) => ({ ...s, errors: s.errors + 1 })),
            }}
          />
        )}
        <Graticule />
        <FitTo points={fitPts} token={token} />
        <FlyToSelected pos={sel ? [sel.lat, sel.lon] : null} />

        {!results &&
          poolPts.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={p.kind === 'earth_named' ? 6.5 : 4}
              pathOptions={{
                color: p.status === 'ok' ? POOL_HALO : MARKER_EXCLUDED,
                weight: p.kind === 'earth_named' ? 2 : 1.5,
                fillColor: p.status === 'ok'
                  ? (p.kind === 'earth_named' ? MARKER_NAMED : MARKER_SURVEY)
                  : 'transparent',
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs">{fmtCoord(p.lat, p.lon)} · {KIND_LABEL[p.kind]}</p>
                {p.status !== 'ok' && <p className="text-xs text-danger">Not usable: insufficient valid elevation data</p>}
              </Popup>
            </CircleMarker>
          ))}

        {showExcluded &&
          (excluded ?? []).filter((r) => isValidCoord(r.lat, r.lon)).map((r) => (
            <CircleMarker key={r.id} center={[r.lat, r.lon]} radius={4} pathOptions={{ color: MARKER_EXCLUDED, weight: 1.5, fillOpacity: 0, dashArray: '3 3' }}>
              <Popup>
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-danger">Not ranked: {r.exclusion_reason}</p>
              </Popup>
            </CircleMarker>
          ))}

        {[...ranked].reverse().map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lon]}
            radius={(r.kind === 'earth_named' ? 8 : 6) + (r.id === selectedId ? 4 : 0)}
            pathOptions={{
              color: r.id === selectedId ? STROKE_SELECTED : STROKE,
              weight: r.id === selectedId ? 3 : r.kind === 'earth_named' ? 2.5 : 1.75,
              fillColor: indexColor(r.similarity_index, 'light'),
              fillOpacity: 0.95,
            }}
            eventHandlers={{ click: () => onSelect(r.id) }}
          >
            <Popup>
              <p className="font-semibold">#{r.rank} {r.name}</p>
              <p className="text-xs">{fmtCoord(r.lat, r.lon)}</p>
              <p className="text-xs">Similarity index {r.similarity_index.toFixed(1)} · coverage {(100 * r.coverage).toFixed(0)}%</p>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <Legend hasResults={!!results} />
      {tilesFailed && (
        <div role="status" className="absolute right-3 top-3 z-[1000] max-w-xs rounded-lg border border-warn/30 bg-surface p-2 text-xs text-warn">
          Basemap tiles could not be loaded. Candidate markers are shown on a latitude/longitude graticule (30° spacing).
        </div>
      )}
    </div>
  );
}
