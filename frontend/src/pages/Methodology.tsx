import { ErrorBox, Loading, PageHeader, SectionTitle } from '../components/StateViews';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

/** Body tints, matching the landing page so a dataset reads the same everywhere. */
const BODY_BADGE: Record<string, string> = {
  moon: 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30',
  mars: 'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30',
  earth: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
};

export default function Methodology() {
  const m = useAsync(() => api.methodology(), []);
  const d = useAsync(() => api.datasets(), []);
  const f = useAsync(() => api.features(), []);
  const e = useAsync(() => api.environment(), []);

  const sections: [id: string, label: string][] = [
    ['datasets', 'Datasets'],
    ['considered', 'Also considered'],
    ['method', 'Similarity method'],
    ['features', 'Features'],
    ['thermal', 'Thermal & mineral'],
    ['sensitivity', 'Sensitivity'],
    ['limitations', 'Limitations'],
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Reproducible by design"
        title="Data and methodology"
        aside={
          m.data?.manifest?.built_at && (
            <p className="text-right text-xs text-slate-400">
              <span className="label block">Data build</span>
              <span className="num text-slate-200">{String(m.data.manifest.built_at).slice(0, 10)}</span>
            </p>
          )
        }
      >
        Everything the ranking depends on, served live from the analysis backend — no figure on this page is typed by hand.
      </PageHeader>

      {/* Jump bar: this page is long and people arrive looking for one section. */}
      <nav aria-label="Sections" className="sticky top-14 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 text-xs">
          {sections.map(([id, label]) => (
            <li key={id}>
              {/* A plain `#id` href would overwrite the HashRouter route and
                  land on "page not found", so scroll the section into view. */}
              <button
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="whitespace-nowrap rounded-full border border-slate-800 px-3 py-1 text-slate-400 transition-colors duration-150 hover:border-sky-500/50 hover:bg-slate-900 hover:text-sky-300">
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-5xl space-y-5 p-4">

      <section id="datasets" className="scroll-mt-28 card space-y-3">
        <SectionTitle>Datasets integrated</SectionTitle>
        {d.loading && <Loading />}
        {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
        {d.data?.integrated.map((x) => (
          <details key={x.id} className="group rounded-lg border border-slate-800 p-3 transition-colors duration-200 hover:border-slate-700 open:bg-slate-950/40">
            {/* Collapsed by default, but the summary already carries provider,
                resolution and licence so the list is useful without expanding. */}
            <summary className="cursor-pointer list-none">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`badge ${BODY_BADGE[x.body] ?? 'bg-slate-800 text-slate-300'}`}>{x.body}</span>
                <span className="font-medium text-slate-100 group-hover:text-white">{x.name}</span>
                <span aria-hidden className="ml-auto text-slate-600 transition-transform duration-200 group-open:rotate-90">›</span>
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {x.provider} · {x.spatial_resolution} · {x.license}
              </span>
            </summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[200px_1fr]">
              {([
                ['Provider', x.provider], ['Source', <a key="s" className="link break-all" href={x.source_url} target="_blank" rel="noreferrer">{x.source_url}</a>],
                ['DOI', x.doi ? <a key="d" className="link" href={x.doi} target="_blank" rel="noreferrer">{x.doi}</a> : 'none listed'],
                ['Citation / attribution', x.citation], ['Variables', x.variables.join(', ')], ['Units', x.units],
                ['Spatial resolution', x.spatial_resolution], ['Coverage', x.spatial_coverage], ['Temporal coverage', x.temporal_coverage],
                ['CRS', x.crs], ['License', x.license], ['Authentication', x.authentication], ['Access method', x.access_method],
                ['Preprocessing', x.preprocessing], ['Limitations', x.limitations],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="text-slate-200">{v}</dd></div>
              ))}
            </dl>
          </details>
        ))}
      </section>

      <section id="considered" className="scroll-mt-28 card">
        <SectionTitle sub="Investigated but not integrated in this build, and why.">Other sources considered</SectionTitle>
        <table className="tbl">
          <thead><tr><th>Source</th><th>Status</th><th>Would provide</th></tr></thead>
          <tbody>
            {d.data?.investigated_not_integrated.map((x) => (
              <tr key={x.name}><td><a className="link" href={x.url} target="_blank" rel="noreferrer">{x.name}</a></td><td>{x.status}</td><td>{x.would_provide}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="method" className="scroll-mt-28 card space-y-2 text-sm">
        <SectionTitle>Similarity method</SectionTitle>
        {m.loading && <Loading />}
        {m.error && <ErrorBox message={m.error} onRetry={m.reload} />}
        {m.data && (
          <>
            <p>{m.data.summary}</p>
            <p><span className="text-slate-400">Window:</span> {m.data.window.size_m / 1000} km × {m.data.window.size_m / 1000} km, {m.data.window.grid_res_m} m grid, {m.data.window.projection}; windows with &lt; {100 * m.data.window.min_valid_fraction}% valid cells are not scored.</p>
            <p><span className="text-slate-400">Normalisation:</span> {m.data.normalization}</p>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-sky-200 shadow-inner">{`d_i = (T_i(candidate) − T_i(reference)) / IQR_i        (scalar features)
d_i = W1(slope_hist_candidate, slope_hist_reference) / IQR_slope   (distribution)
${m.data.distance}
${m.data.similarity_index}`}</pre>
            <p><span className="text-slate-400">Missing data:</span> {m.data.missing_data_policy}</p>
            <p><span className="text-slate-400">Weights:</span> {m.data.weights}</p>
            <p className="rounded-lg bg-amber-950/30 p-2 text-amber-100">{m.data.interpretation}</p>
          </>
        )}
      </section>

      <section id="features" className="card max-h-[75vh] scroll-mt-28 overflow-auto">
        <SectionTitle>Features</SectionTitle>
        {f.error && <ErrorBox message={f.error} />}
        <table className="tbl tbl-sticky">
          <thead><tr><th>Feature</th><th>Meaning</th><th>Method</th><th>Transform · scale (IQR)</th><th>Limitations</th></tr></thead>
          <tbody>
            {f.data?.features.map((x) => (
              <tr key={x.key}>
                <td className="font-medium text-slate-100">{x.label}<div className="text-[10px] text-slate-500">{x.unit}</div></td>
                <td>{x.meaning}</td>
                <td>{x.method}</td>
                <td className="font-mono text-xs">{x.transform}{x.transform === 'log10' ? `(x+${x.log_offset})` : ''} · {f.data!.scales[x.key]?.toFixed(3)}</td>
                <td className="text-slate-400">{x.limitations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="thermal" className="card scroll-mt-28 space-y-2 text-sm">
        <SectionTitle sub="Built separately from the terrain layer and merged onto each location, because coverage is uneven by nature.">
          Thermal and mineral layer
        </SectionTitle>
        {e.loading && <Loading />}
        {e.error && <ErrorBox message={e.error} onRetry={e.reload} />}
        {e.data && (
          <>
            <p>
              Measured for <b>{e.data.earth_windows_with_thermal_feature}</b> of {e.data.earth_windows_ok} complete Earth
              windows (thermal) and <b>{e.data.earth_windows_with_mineral_classes}</b> (mineral classes); built{' '}
              {e.data.built_at ?? 'not yet'}.
            </p>
            <p>
              <span className="text-slate-400">Comparable across bodies:</span> {e.data.comparable_features.join(', ') || 'none'}.
              Its default weight is 0, so the terrain-only ranking is unchanged unless you switch it on.
            </p>
            <p className="text-slate-400">{e.data.display_only}</p>
            <details className="rounded-lg border border-slate-800 p-2">
              <summary className="cursor-pointer text-xs text-slate-300">Build parameters and percentile references</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                {JSON.stringify({ parameters: e.data.parameters, percentile_reference: e.data.percentile_reference }, null, 1)}
              </pre>
            </details>
          </>
        )}
      </section>

      {m.data?.sensitivity && (
        <section id="sensitivity" className="card scroll-mt-28 text-sm">
          <SectionTitle sub={m.data.sensitivity.description}>Sensitivity analysis</SectionTitle>
          <table className="tbl">
            <thead><tr><th>Perturbation</th><th>Median Spearman ρ vs baseline</th><th>Median top-10 overlap</th><th>Targets</th></tr></thead>
            <tbody>
              {m.data.sensitivity.experiments.map((e: { name: string; median_spearman: number; median_top10_overlap: number; n_targets: number }) => (
                <tr key={e.name}><td>{e.name}</td><td className="font-mono">{e.median_spearman.toFixed(3)}</td><td className="font-mono">{e.median_top10_overlap.toFixed(1)} / 10</td><td>{e.n_targets}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section id="limitations" className="card scroll-mt-28 text-sm">
        <SectionTitle>Scientific limitations</SectionTitle>
        <ul className="space-y-2 text-slate-300 [&>li]:rounded-lg [&>li]:border [&>li]:border-slate-800/70 [&>li]:bg-slate-950/40 [&>li]:p-2.5 [&>li]:transition-colors [&>li]:duration-150 [&>li:hover]:border-slate-700 [&>li:hover]:bg-slate-900/60">
          <li>The default ranking compares terrain geometry only. Thermophysical character enters only through the thermal-inertia percentile, which is off by default; atmosphere, gravity, radiation, illumination and regolith depth are never represented.</li>
          <li>The thermal-inertia percentile compares ranks, not physical values: Earth's apparent thermal inertia (K⁻¹, from ECOSTRESS and VIIRS) and Mars' TES thermal inertia (tiu) are different quantities, and matching their within-body percentiles assumes the two distributions correspond. Earth percentiles are relative to this app's arid/volcanic/polar pool, not to Earth as a whole, and the Moon has no thermal-inertia product in the archives reachable here.</li>
          <li>EMIT mineral identifications are per-pixel spectral-library matches grouped into classes by this project, available only where EMIT has flown; they have no planetary counterpart in this build, so they are shown but never scored.</li>
          <li>All features are scale-dependent; results apply to 12 km windows on a 30 m grid only.</li>
          <li>Earth heights come from a surface model (vegetation, buildings, ice surfaces included); lunar and Martian DTMs are bare-surface products with their own interpolation and stereo noise. Short-baseline roughness is the most affected feature.</li>
          <li>Planetary targets are limited to products in the USGS analysis-ready archive: 8 lunar south-polar sites and 4 Martian CTX DTM windows.</li>
          <li>Named analog site coordinates are approximate and unverified; survey cells are a coarse, regionally limited grid, not a global search.</li>
          <li>Robust scales depend on the Earth reference pool, so indices are only comparable within one data build and configuration.</li>
          <li>The similarity index is not a probability and says nothing about landing safety, habitability or mission suitability.</li>
        </ul>
      </section>
      </div>
    </div>
  );
}
