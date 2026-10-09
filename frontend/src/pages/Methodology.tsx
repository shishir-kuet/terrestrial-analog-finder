import { ErrorBox, Loading, SectionTitle } from '../components/StateViews';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

export default function Methodology() {
  const m = useAsync(() => api.methodology(), []);
  const d = useAsync(() => api.datasets(), []);
  const f = useAsync(() => api.features(), []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <header>
        <h1 className="text-2xl font-semibold text-white">Data and methodology</h1>
        <p className="text-sm text-slate-400">Everything the ranking depends on, served live from the analysis backend.</p>
      </header>

      <section className="card space-y-3">
        <SectionTitle>Datasets integrated</SectionTitle>
        {d.loading && <Loading />}
        {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
        {d.data?.integrated.map((x) => (
          <details key={x.id} className="rounded-lg border border-slate-800 p-3" open>
            <summary className="cursor-pointer font-medium text-slate-100">{x.name} <span className="badge ml-1 bg-slate-800 text-slate-300">{x.body}</span></summary>
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

      <section className="card">
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

      <section className="card space-y-2 text-sm">
        <SectionTitle>Similarity method</SectionTitle>
        {m.loading && <Loading />}
        {m.error && <ErrorBox message={m.error} onRetry={m.reload} />}
        {m.data && (
          <>
            <p>{m.data.summary}</p>
            <p><span className="text-slate-400">Window:</span> {m.data.window.size_m / 1000} km × {m.data.window.size_m / 1000} km, {m.data.window.grid_res_m} m grid, {m.data.window.projection}; windows with &lt; {100 * m.data.window.min_valid_fraction}% valid cells are not scored.</p>
            <p><span className="text-slate-400">Normalisation:</span> {m.data.normalization}</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-sky-200">{`d_i = (T_i(candidate) − T_i(reference)) / IQR_i        (scalar features)
d_i = W1(slope_hist_candidate, slope_hist_reference) / IQR_slope   (distribution)
${m.data.distance}
${m.data.similarity_index}`}</pre>
            <p><span className="text-slate-400">Missing data:</span> {m.data.missing_data_policy}</p>
            <p><span className="text-slate-400">Weights:</span> {m.data.weights}</p>
            <p className="rounded-lg bg-amber-950/30 p-2 text-amber-100">{m.data.interpretation}</p>
          </>
        )}
      </section>

      <section className="card overflow-x-auto">
        <SectionTitle>Features</SectionTitle>
        {f.error && <ErrorBox message={f.error} />}
        <table className="tbl">
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

      {m.data?.sensitivity && (
        <section className="card text-sm">
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

      <section className="card text-sm">
        <SectionTitle>Scientific limitations</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Only terrain geometry is compared. Composition, temperature, atmosphere, gravity, radiation, illumination and regolith properties are not represented.</li>
          <li>All features are scale-dependent; results apply to 12 km windows on a 30 m grid only.</li>
          <li>Earth heights come from a surface model (vegetation, buildings, ice surfaces included); lunar and Martian DTMs are bare-surface products with their own interpolation and stereo noise. Short-baseline roughness is the most affected feature.</li>
          <li>Planetary targets are limited to products in the USGS analysis-ready archive: 8 lunar south-polar sites and 4 Martian CTX DTM windows.</li>
          <li>Named analog site coordinates are approximate and unverified; survey cells are a coarse, regionally limited grid, not a global search.</li>
          <li>Robust scales depend on the Earth reference pool, so indices are only comparable within one data build and configuration.</li>
          <li>The similarity index is not a probability and says nothing about landing safety, habitability or mission suitability.</li>
        </ul>
      </section>
    </div>
  );
}
