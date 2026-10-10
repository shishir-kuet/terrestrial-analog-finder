import { Link } from 'react-router-dom';
import { HypsoChart, SlopeDistChart } from '../components/Charts';
import { Hillshade } from '../components/CandidateDetail';
import { Empty, ErrorBox, IndexMeter, Loading, PageHeader, SectionTitle } from '../components/StateViews';
import { api } from '../lib/api';
import { fmtCoord, fmtValue, indexColor, SERIES_COLORS } from '../lib/format';
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
    <div>
      <PageHeader
        eyebrow={`Side by side · ${t.body === 'moon' ? 'Moon' : 'Mars'}`}
        title={<>Compare with <span className="text-sky-300">{t.name}</span></>}
        aside={
          <Link to="/explore" className="btn-ghost">← Back to Explorer</Link>
        }
      >
        Same scoring configuration as the last search.{' '}
        {cands.length === 0 && 'Add candidates from the Explorer to compare them here.'}
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-4 p-4">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card card-hover rise p-2 ring-1 ring-inset ring-amber-500/30">
          <Hillshade id={t.id} label={`Reference · ${t.name}`} />
          <p className="mt-2 text-center text-[11px] text-amber-300/90">everything is measured against this</p>
        </div>
        {cands.map((c, i) => (
          <div key={c.id} className="card card-hover rise p-2" style={{ animationDelay: `${(i + 1) * 70}ms` }}>
            <Hillshade id={c.id} label={`#${c.rank} ${c.name}`} />
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="label">Index</span>
              <span className="num text-lg font-semibold text-white">{c.similarity_index.toFixed(1)}</span>
            </div>
            <div className="mt-1"><IndexMeter value={c.similarity_index} color={indexColor(c.similarity_index)} /></div>
            <button className="btn-ghost mt-2 w-full text-xs" onClick={() => s.toggleCompare(c.id)}>Remove</button>
          </div>
        ))}
        {/* A visible slot invites the third comparison rather than leaving a gap. */}
        {cands.length < 3 && (
          <Link to="/explore"
            className="grid min-h-[8rem] place-items-center rounded-xl border border-dashed border-slate-700 p-2 text-center text-xs text-slate-500 transition-colors duration-200 hover:border-sky-500/50 hover:bg-slate-900/60 hover:text-sky-300">
            + Add another candidate
            <span className="block text-[10px] text-slate-600">up to three</span>
          </Link>
        )}
      </div>

      {featuresQ.error && <ErrorBox message={featuresQ.error} />}
      <div className="card max-h-[70vh] overflow-auto">
        <SectionTitle sub="Measured values per 12 km window. 'unavailable' = not measured; no value is imputed.">Feature table</SectionTitle>
        <table className="tbl tbl-sticky">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-slate-900/95 backdrop-blur">Feature</th>
              <th style={{ color: SERIES_COLORS[0] }}>Reference</th>
              {cands.map((c, i) => <th key={c.id} style={{ color: SERIES_COLORS[(i + 1) % SERIES_COLORS.length] }}>#{c.rank} {c.name.slice(0, 32)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td className="sticky left-0 bg-slate-900/90 text-slate-400 backdrop-blur">Coordinates</td><td>{fmtCoord(t.lat, t.lon)}</td>{cands.map((c) => <td key={c.id}>{fmtCoord(c.lat, c.lon)}</td>)}</tr>
            <tr><td className="sticky left-0 bg-slate-900/90 text-slate-400 backdrop-blur">Similarity index</td><td>—</td>{cands.map((c) => <td key={c.id} className="num font-semibold text-white">{c.similarity_index.toFixed(1)}</td>)}</tr>
            <tr><td className="sticky left-0 bg-slate-900/90 text-slate-400 backdrop-blur">Coverage</td><td>—</td>{cands.map((c) => <td key={c.id}>{(100 * c.coverage).toFixed(0)}%</td>)}</tr>
            {defs.filter((d) => d.kind === 'scalar').map((d) => (
              <tr key={d.key}>
                <td className="sticky left-0 bg-slate-900/90 text-slate-400 backdrop-blur">{d.label} <span className="text-[10px]">({d.unit})</span></td>
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
    </div>
  );
}
