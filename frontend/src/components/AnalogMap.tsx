import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Candidate, LocationSummary } from '../lib/types';
import { fmtCoord, indexColor, isValidCoord, KIND_LABEL } from '../lib/format';

// A muted dark basemap, so the markers carry the data and the map recedes.
// Esri's Dark Gray Canvas serves without an API key; CARTO's equivalent now
// returns a watermarked "API KEY REQUIRED" tile, so do not go back to it.
const TILE_URL =
  (import.meta.env.VITE_TILE_URL as string | undefined) ??
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

// Marker chrome for the dark basemap. A near-black hairline separates adjacent
// markers without competing with the similarity fill.
const STROKE = '#12120f';
const STROKE_SELECTED = '#5eead4';
const GRATICULE = '#e8e6df';
const POOL_FILL = '#55544e';
const POOL_STROKE = '#7a796f';
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
        <Polyline key={i} positions={l} pathOptions={{ color: GRATICULE, weight: 1, opacity: 0.35, dashArray: '5 6' }} interactive={false} />
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
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[1000] w-44 sm:w-56 rounded-lg border border-line bg-surface p-2.5 text-xs text-ink-muted shadow-lg" aria-label="Map legend">
      <p className="mb-1 font-semibold text-ink">Legend</p>
      {hasResults ? (
        <>
          <div className="h-2 w-full rounded" style={{ background: `linear-gradient(to right, ${[0, 40, 60, 75, 90, 100].map(indexColor).join(',')})` }} />
          <div className="flex justify-between text-[10px] text-ink-muted">
            <span>0</span>
            <span>similarity index</span>
            <span>100</span>
          </div>
        </>
      ) : (
        <p className="text-ink-muted">Run a search to colour candidates by similarity.</p>
      )}
      <div className="mt-1.5 hidden space-y-0.5 sm:block">
        <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-white align-middle" /> named analog site (larger)</p>
        <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink-faint align-middle" /> survey grid cell</p>
        <p><span className="mr-1 inline-block h-2 w-2 rounded-full border border-danger align-middle" /> not ranked (missing data)</p>
      </div>
      <p className="mt-1.5 hidden text-[10px] text-ink-faint sm:block">Markers mark the centre of a 12 km × 12 km analysis window.</p>
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
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-lg border border-line shadow-card">
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
              radius={p.kind === 'earth_named' ? 6 : 3.5}
              pathOptions={{
                color: p.kind === 'earth_named' ? STROKE : POOL_STROKE,
                weight: 1,
                fillColor: p.status === 'ok' ? POOL_FILL : 'transparent',
                fillOpacity: 0.7,
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
            <CircleMarker key={r.id} center={[r.lat, r.lon]} radius={4} pathOptions={{ color: '#fb7185', weight: 1.5, fillOpacity: 0, dashArray: '3 3' }}>
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
              weight: r.id === selectedId ? 3 : r.kind === 'earth_named' ? 2 : 1,
              fillColor: indexColor(r.similarity_index),
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
