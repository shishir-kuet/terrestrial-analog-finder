import { Link } from 'react-router-dom';
import { api, hillshadeUrl } from '../lib/api';
import { fmtCoord, fmtValue, KIND_LABEL } from '../lib/format';
import type { Candidate, Dataset, FeatureDef, SearchResponse } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { ContributionChart, HypsoChart, SlopeDistChart } from './Charts';
import EnvironmentPanel from './Environment';
import { CoordBadge, ErrorBox, Loading, SectionTitle } from './StateViews';

interface Props {
  candidate: Candidate;
  response: SearchResponse;
  defs: Record<string, FeatureDef>;
  datasets: Dataset[];
  onClose?: () => void;
  inCompare: boolean;
  onToggleCompare: () => void;
}

export function Hillshade({ id, label }: { id: string; label: string }) {
  return (
    <figure className="text-center">
      <img src={hillshadeUrl(id)} alt={`Hillshade of ${label}`} className="aspect-square w-full rounded-md border border-slate-800 bg-slate-800 object-cover" loading="lazy"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')} />
      <figcaption className="mt-1 text-[11px] text-slate-400">{label}</figcaption>
    </figure>
  );
}

export function DatasetLink({ ds }: { ds: Dataset | undefined }) {
  if (!ds) return <span className="text-slate-400">dataset metadata unavailable</span>;
  return (
    <span>
      <a className="link" href={ds.source_url} target="_blank" rel="noreferrer">{ds.name}</a>
      {ds.doi && (
        <> · <a className="link" href={ds.doi} target="_blank" rel="noreferrer">DOI</a></>
      )}
      <span className="text-slate-400"> · {ds.license}</span>
    </span>
  );
}

export default function CandidateDetail({ candidate: c, response, defs, datasets, onClose, inCompare, onToggleCompare }: Props) {
  const detail = useAsync(() => api.location(c.id), [c.id]);
  const t = response.target;
  const tName = `${t.name} (${t.body === 'moon' ? 'Moon' : 'Mars'})`;
  const ds = (id: string) => datasets.find((d) => d.id === id);

  return (
    <article className="space-y-4" aria-label={`Details for ${c.name}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="label">Rank #{c.rank} · {KIND_LABEL[c.kind]}</p>
          <h2 className="text-lg font-semibold text-white">{c.name}</h2>
          <p className="text-sm text-slate-300">
            {fmtCoord(c.lat, c.lon)} <CoordBadge status={c.coordinate_status} />
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-ghost" onClick={onToggleCompare} aria-pressed={inCompare}>
            {inCompare ? 'Remove from compare' : 'Add to compare'}
          </button>
          {onClose && (
            <button className="btn-ghost" onClick={onClose} aria-label="Close details">✕</button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-950/60 p-3 text-center">
        <div><p className="label">Similarity index</p><p className="text-2xl font-semibold text-white">{c.similarity_index.toFixed(1)}</p></div>
        <div><p className="label">Distance D</p><p className="text-2xl font-semibold text-white">{c.distance.toFixed(3)}</p><p className="text-[10px] text-slate-500">IQR units</p></div>
        <div><p className="label">Data coverage</p><p className="text-2xl font-semibold text-white">{(100 * c.coverage).toFixed(0)}%</p></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Hillshade id={t.id} label={`Reference: ${tName}`} />
        <Hillshade id={c.id} label={`Candidate: ${c.name}`} />
      </div>
      <p className="text-[11px] text-slate-500">Hillshades rendered from the same 12 km × 12 km, 30 m windows used for the features (illumination azimuth 315°, altitude 45°). Display only.</p>

      <section>
        <SectionTitle sub="Values are measured on each window; differences are robust-scaled (÷ IQR of the Earth reference pool) after the listed transform.">
          Per-feature comparison
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th>Feature</th><th>Reference</th><th>Candidate</th><th>Scaled diff.</th><th>Weight</th><th>Share of D²</th></tr>
            </thead>
            <tbody>
              {c.comparisons.map((x) => {
                const d = defs[x.key];
                const dist = d?.kind === 'distribution';
                return (
                  <tr key={x.key}>
                    <td>
                      <span className="font-medium text-slate-100">{d?.label ?? x.key}</span>
                      {d?.transform === 'log10' && <span className="ml-1 text-[10px] text-slate-500">log₁₀</span>}
                    </td>
                    <td>{dist ? 'histogram' : fmtValue(x.target_value, d)}</td>
                    <td className={x.status !== 'compared' ? 'text-rose-300' : ''}>
                      {x.status !== 'compared' ? `unavailable (${x.note})` : dist ? `W₁ = ${fmtValue(x.candidate_value, d)}` : fmtValue(x.candidate_value, d)}
                    </td>
                    <td className="font-mono">{x.scaled_difference === null ? `penalty ${response.config.missing_penalty}` : x.scaled_difference.toFixed(2)}</td>
                    <td className="font-mono">{(100 * x.normalized_weight).toFixed(0)}%</td>
                    <td className="font-mono">{(100 * x.contribution_share).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {c.missing_features.length > 0 && (
          <p className="mt-2 text-xs text-rose-300">Missing measurements: {c.missing_features.map((k) => defs[k]?.label ?? k).join(', ')}. Counted as a {response.config.missing_penalty}-IQR mismatch, never as a match.</p>
        )}
      </section>

      <section>
        <SectionTitle sub="Which features drive the remaining difference between this candidate and the reference.">Why this rank?</SectionTitle>
        <ContributionChart candidate={c} defs={defs} />
      </section>

      {detail.loading && <Loading label="Loading distributions and provenance…" />}
      {detail.error && <ErrorBox message={detail.error} onRetry={detail.reload} />}
      {detail.data && (
        <>
          <section>
            <SectionTitle sub="Computed slope histograms (1° bins) of both windows.">Slope distribution</SectionTitle>
            <SlopeDistChart series={[{ name: `Reference: ${t.name}`, values: t.slope_hist }, { name: c.name.slice(0, 40), values: detail.data.slope_hist }]} />
          </section>
          <section>
            <SectionTitle sub="Elevation relative to each window's median (datum-independent). A hypsometric curve on its side.">Relative elevation distribution</SectionTitle>
            <HypsoChart series={[{ name: `Reference: ${t.name}`, values: t.rel_elev_quantiles }, { name: c.name.slice(0, 40), values: detail.data.rel_elev_quantiles }]} />
          </section>
          <section>
            <SectionTitle sub="Measured from ECOSTRESS, VIIRS, EMIT, MGS TES and LRO Diviner. Only the thermal-inertia percentile takes part in scoring; everything here is context, because no planetary counterpart measuring the same quantity was found in the archives reachable from this build.">
              Thermal and mineral measurements
            </SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <EnvironmentPanel env={t.environment} title={`Reference: ${tName}`}
                missingReason={t.missing_reasons?.thermal_inertia_percentile} />
              <EnvironmentPanel env={detail.data.environment} title={`Candidate: ${c.name}`}
                missingReason={detail.data.missing_reasons?.thermal_inertia_percentile} />
            </div>
          </section>
          <section className="text-sm">
            <SectionTitle>Sources and processing</SectionTitle>
            <ul className="space-y-1 text-slate-300">
              <li><span className="text-slate-400">Candidate data:</span> <DatasetLink ds={ds(c.dataset_id)} /></li>
              <li><span className="text-slate-400">Reference data:</span> <DatasetLink ds={ds(t.dataset_id)} /></li>
              <li><span className="text-slate-400">Coordinates:</span> {detail.data.coordinate_source}</li>
              <li><span className="text-slate-400">Window:</span> 12 km × 12 km, 30 m grid, valid cells {(100 * (detail.data.valid_fraction ?? 0)).toFixed(1)}%, resampling {String(detail.data.processing?.resampling ?? 'n/a')}</li>
              <li><span className="text-slate-400">Median absolute elevation (context only, not compared):</span> {fmtValue(detail.data.absolute_elevation_median_m, { unit: 'm', key: '' })} (Copernicus DEM, EGM2008 heights)</li>
            </ul>
          </section>
        </>
      )}

      <section className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100/90">
        <p className="font-semibold">Limitations</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Ranking is terrain-based at the 12 km scale. Gravity, atmosphere, regolith depth, radiation and illumination are not considered, and the thermal measurements take part only when their feature is given a weight.</li>
          <li>Where the thermal-inertia percentile is used, Earth's apparent thermal inertia and Mars' TES thermal inertia are different quantities in different units; only their ranks within each body are compared, and the two distributions are not calibrated against each other.</li>
          <li>Mineral identifications come from EMIT's spectral-library match per pixel, grouped into classes by this project; they describe surface spectra, not bulk rock composition, and have no planetary counterpart here.</li>
          <li>The Copernicus DEM is a surface model (vegetation and buildings included); planetary DTMs are bare surfaces with their own interpolation and stereo noise.</li>
          <li>A high index means similar measured terrain statistics, not a physically identical environment, a landing site or a safe habitat location.</li>
          {c.coordinate_status === 'approximate_unverified' && <li>This site's coordinates are approximate and unverified; the window may not be centred on the named feature.</li>}
        </ul>
        <p className="mt-1"><Link to="/methodology" className="link">Full methodology and limitations →</Link></p>
      </section>
    </article>
  );
}
