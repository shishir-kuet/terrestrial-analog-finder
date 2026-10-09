import { Link } from 'react-router-dom';
import { HypsoChart, SlopeDistChart } from '../components/Charts';
import { Hillshade } from '../components/CandidateDetail';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/StateViews';
import { api } from '../lib/api';
import { fmtCoord, fmtValue, SERIES_COLORS } from '../lib/format';
import { useSearch } from '../lib/SearchContext';
import { useAsync } from '../lib/useAsync';

export default function Compare() {
  const s = useSearch();
  const res = s.lastResponse;
  const ids = s.compareIds;
  const featuresQ = useAsync(() => api.features(), []);
  const detailsQ = useAsync(() => Promise.all(ids.map((id) => api.location(id))), [ids.join(',')]);

  if (!res)
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Empty title="Nothing to compare yet">Run a search in the <Link className="link" to="/explore">Explorer</Link>, open a candidate and press “Add to compare” (up to three).</Empty>
      </div>
    );

  const defs = featuresQ.data?.features ?? [];
  const t = res.target;
  const cands = ids.map((id) => res.results.find((r) => r.id === id)).filter(Boolean) as typeof res.results;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-white">Compare with {t.name} ({t.body === 'moon' ? 'Moon' : 'Mars'})</h1>
        <p className="text-sm text-slate-400">
          Same scoring configuration as the last search. {cands.length === 0 && 'Add candidates from the Explorer to compare them here.'}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-2"><Hillshade id={t.id} label={`Reference · ${t.name}`} /></div>
        {cands.map((c) => (
          <div key={c.id} className="card p-2">
            <Hillshade id={c.id} label={`#${c.rank} ${c.name}`} />
            <button className="btn-ghost mt-2 w-full text-xs" onClick={() => s.toggleCompare(c.id)}>Remove</button>
          </div>
        ))}
      </div>

      {featuresQ.error && <ErrorBox message={featuresQ.error} />}
      <div className="card overflow-x-auto">
        <SectionTitle sub="Measured values per 12 km window. 'unavailable' = not measured; no value is imputed.">Feature table</SectionTitle>
        <table className="tbl">
          <thead>
            <tr>
              <th>Feature</th>
              <th style={{ color: SERIES_COLORS[0] }}>Reference</th>
              {cands.map((c, i) => <th key={c.id} style={{ color: SERIES_COLORS[(i + 1) % SERIES_COLORS.length] }}>#{c.rank} {c.name.slice(0, 32)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td className="text-slate-400">Coordinates</td><td>{fmtCoord(t.lat, t.lon)}</td>{cands.map((c) => <td key={c.id}>{fmtCoord(c.lat, c.lon)}</td>)}</tr>
            <tr><td className="text-slate-400">Similarity index</td><td>—</td>{cands.map((c) => <td key={c.id} className="font-mono">{c.similarity_index.toFixed(1)}</td>)}</tr>
            <tr><td className="text-slate-400">Coverage</td><td>—</td>{cands.map((c) => <td key={c.id}>{(100 * c.coverage).toFixed(0)}%</td>)}</tr>
            {defs.filter((d) => d.kind === 'scalar').map((d) => (
              <tr key={d.key}>
                <td className="text-slate-400">{d.label} <span className="text-[10px]">({d.unit})</span></td>
                <td>{fmtValue(t.features[d.key], d)}</td>
                {cands.map((c) => {
                  const cmp = c.comparisons.find((x) => x.key === d.key);
                  const v = cmp ? cmp.candidate_value : detailsQ.data?.find((x) => x.id === c.id)?.features[d.key];
                  return (
                    <td key={c.id} className={v === null || v === undefined ? 'text-rose-300' : ''}>
                      {fmtValue(v ?? null, d)}
                      {cmp?.scaled_difference != null && <span className="ml-1 text-[10px] text-slate-500">(Δ {cmp.scaled_difference.toFixed(2)} IQR)</span>}
                      {!cmp && <span className="ml-1 text-[10px] text-slate-500">(not in score)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailsQ.loading && ids.length > 0 && <Loading label="Loading distributions…" />}
      {detailsQ.error && <ErrorBox message={detailsQ.error} onRetry={detailsQ.reload} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <SectionTitle sub="Fraction of window area per 1° slope bin.">Slope distributions</SectionTitle>
          <SlopeDistChart series={[{ name: `Reference: ${t.name}`, values: t.slope_hist }, ...(detailsQ.data ?? []).map((d) => ({ name: d.name.slice(0, 30), values: d.slope_hist }))]} />
        </div>
        <div className="card">
          <SectionTitle sub="Elevation relative to each window's median.">Relative elevation distributions</SectionTitle>
          <HypsoChart series={[{ name: `Reference: ${t.name}`, values: t.rel_elev_quantiles }, ...(detailsQ.data ?? []).map((d) => ({ name: d.name.slice(0, 30), values: d.rel_elev_quantiles }))]} />
        </div>
      </div>
    </div>
  );
}
