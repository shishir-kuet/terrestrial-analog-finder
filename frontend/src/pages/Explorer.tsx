import { useEffect, useMemo, useState } from 'react';
import AnalogMap from '../components/AnalogMap';
import CandidateDetail, { DatasetLink, Hillshade } from '../components/CandidateDetail';
import { RankingChart } from '../components/Charts';
import { CoordBadge, Empty, ErrorBox, IndexMeter, Loading, PageHeader, SectionTitle, StepLabel } from '../components/StateViews';
import { api } from '../lib/api';
import { fmtCoord, fmtValue, indexColor, KIND_LABEL } from '../lib/format';
import { useSearch } from '../lib/SearchContext';
import type { FeatureDef, SearchRequest } from '../lib/types';
import { useAsync } from '../lib/useAsync';

type Weights = Record<string, { on: boolean; w: number }>;

function defaultWeights(defs: FeatureDef[]): Weights {
  // Features with a default weight of 0 start switched off, so the default
  // search is the terrain-only ranking the methodology describes.
  return Object.fromEntries(defs.map((d) => [d.key, { on: d.default_weight > 0, w: d.default_weight }]));
}

export default function Explorer() {
  const s = useSearch();
  const featuresQ = useAsync(() => api.features(), []);
  const targetsQ = useAsync(() => api.targets(s.body), [s.body]);
  const poolQ = useAsync(() => api.earth(), []);
  const regionsQ = useAsync(() => api.regions(), []);
  const datasetsQ = useAsync(() => api.datasets(), []);
  const envQ = useAsync(() => api.environment(), []);

  const [weights, setWeights] = useState<Weights>({});
  const [kinds, setKinds] = useState({ earth_named: true, earth_survey: true });
  const [regionSel, setRegionSel] = useState<string[] | null>(null);
  const [minCoverage, setMinCoverage] = useState(1);
  const [penalty, setPenalty] = useState(3);
  const [limit, setLimit] = useState(25);
  const [running, setRunning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'earth_named' | 'earth_survey'>('all');
  const [showExcluded, setShowExcluded] = useState(false);

  const envFeatures = envQ.data?.comparable_features ?? [];
  const envCoverage = envQ.data
    ? { measured: envQ.data.earth_windows_with_thermal_feature, total: envQ.data.earth_windows_ok }
    : null;

  const defs = useMemo(() => Object.fromEntries((featuresQ.data?.features ?? []).map((f) => [f.key, f])), [featuresQ.data]);

  useEffect(() => {
    if (featuresQ.data && !Object.keys(weights).length) setWeights(defaultWeights(featuresQ.data.features));
  }, [featuresQ.data, weights]);

  useEffect(() => {
    const ts = targetsQ.data;
    if (ts && ts.length && !ts.some((t) => t.id === s.targetId)) s.setTargetId(ts[0].id);
  }, [targetsQ.data, s]);

  const target = targetsQ.data?.find((t) => t.id === s.targetId) ?? null;
  const res = s.lastResponse && s.lastResponse.target.id === s.targetId ? s.lastResponse : null;
  const visible = (res?.results ?? []).filter((r) => listFilter === 'all' || r.kind === listFilter);
  const selected = res?.results.find((r) => r.id === selectedId) ?? null;

  const activeWeights = Object.fromEntries(Object.entries(weights).filter(([, v]) => v.on).map(([k, v]) => [k, v.w]));
  const weightsReady = Object.keys(weights).length > 0;
  const weightError = !weightsReady
    ? null
    : !Object.values(activeWeights).some((w) => w > 0)
    ? 'Select at least one feature with a weight above zero.'
    : !kinds.earth_named && !kinds.earth_survey
      ? 'Select at least one candidate type.'
      : regionSel !== null && regionSel.length === 0 && kinds.earth_survey && !kinds.earth_named
        ? 'Select at least one survey region.'
        : null;

  async function runSearch() {
    if (!target || weightError) return;
    const req: SearchRequest = {
      target_id: target.id,
      weights: activeWeights,
      candidate_kinds: (Object.keys(kinds) as ('earth_named' | 'earth_survey')[]).filter((k) => kinds[k]),
      regions: regionSel,
      min_coverage: minCoverage,
      missing_penalty: penalty,
      limit,
    };
    setRunning(true);
    setSearchError(null);
    try {
      const r = await api.search(req);
      s.setResult(req, r);
      setSelectedId(r.results[0]?.id ?? null);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const bootError = featuresQ.error || targetsQ.error || poolQ.error;
  if (bootError)
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorBox message={bootError} onRetry={() => { featuresQ.reload(); targetsQ.reload(); poolQ.reload(); }} />
      </div>
    );

  return (
    <div>
      <PageHeader
        compact
        eyebrow={s.body === 'moon' ? 'Lunar reference' : 'Martian reference'}
        title={target ? `Earth analogs for ${target.name}` : 'Explorer'}
        aside={
          <dl className="flex gap-5 text-right">
            {[
              ['Candidate pool', poolQ.data ? poolQ.data.length.toLocaleString() : '—'],
              ['Ranked', res ? String(res.results.length) : '—'],
              ['In compare', String(s.compareIds.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label">{k}</dt>
                <dd className="text-lg font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>
        }
      >
        Set the weights yourself, then read the per-feature breakdown behind every score.
      </PageHeader>

      <div className="grid gap-4 p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* ------------------------------------------------ controls */}
      <aside className="space-y-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1" aria-label="Search configuration">
        <div className="card space-y-3">
          <div>
            <StepLabel n={1}>Planetary body</StepLabel>
            <div role="radiogroup" aria-label="Planetary body" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1">
              {(['moon', 'mars'] as const).map((b) => (
                <button key={b} role="radio" aria-checked={s.body === b}
                  className={`rounded-md py-1.5 text-sm font-medium transition-all duration-200 ${s.body === b ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  onClick={() => { s.setBody(b); s.setTargetId(null); setSelectedId(null); }}>
                  {b === 'moon' ? 'Moon' : 'Mars'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <StepLabel n={2}>Reference region</StepLabel>
            <label htmlFor="target" className="sr-only">Reference region</label>
            {targetsQ.loading ? <Loading label="Loading regions…" /> : (
              <select id="target" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                value={s.targetId ?? ''} onChange={(e) => { s.setTargetId(e.target.value); setSelectedId(null); }}>
                {(targetsQ.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          {target && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="zoomable w-28 shrink-0 rounded-md"><Hillshade id={target.id} label="12 km window" /></div>
                <div className="text-xs text-slate-300">
                  <p>{fmtCoord(target.lat, target.lon)}</p>
                  <p className="mt-0.5"><CoordBadge status={target.coordinate_status} /></p>
                  <p className="mt-1 text-slate-400">{target.source_item?.title}</p>
                  <p className="mt-1"><DatasetLink ds={datasetsQ.data?.integrated.find((d) => d.id === target.dataset_id)} /></p>
                </div>
              </div>
              {target.selection_note && <p className="text-[11px] text-slate-500">{target.selection_note}</p>}
              <table className="tbl text-xs">
                <tbody>
                  {Object.entries(target.features).map(([k, v]) => (
                    <tr key={k}><td className="text-slate-400">{defs[k]?.label ?? k}</td><td className="text-right font-mono">{fmtValue(v, defs[k])}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <StepLabel n={3}>Features and weights</StepLabel>
          {featuresQ.loading && <Loading />}
          {(featuresQ.data?.features ?? []).map((f) => {
            const w = weights[f.key];
            if (!w) return null;
            return (
              <div key={f.key}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm" title={f.meaning}>
                    <input type="checkbox" checked={w.on} onChange={(e) => setWeights({ ...weights, [f.key]: { ...w, on: e.target.checked } })} />
                    {f.label} <span className="text-[10px] text-slate-500">({f.unit})</span>
                  </label>
                  <span className="font-mono text-xs text-slate-400">{w.w.toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={3} step={0.25} value={w.w} disabled={!w.on} aria-label={`Weight for ${f.label}`}
                  className="w-full accent-sky-400" onChange={(e) => setWeights({ ...weights, [f.key]: { ...w, w: +e.target.value } })} />
                {envCoverage !== null && envFeatures.includes(f.key) && (
                  <p className={`text-[11px] ${w.on && w.w > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                    Measured for {envCoverage.measured} of {envCoverage.total} Earth windows
                    {target && target.features[f.key] === null && ` · not available for ${target.name}`}
                    {w.on && w.w > 0 && minCoverage === 1 && ' · at 100 % coverage the rest will not be ranked'}
                  </p>
                )}
              </div>
            );
          })}
          <button className="btn-ghost w-full" onClick={() => featuresQ.data && setWeights(defaultWeights(featuresQ.data.features))}>Reset weights</button>
        </div>

        <div className="card space-y-3 text-sm">
          <StepLabel n={4}>Earth candidates and rules</StepLabel>
          {(['earth_named', 'earth_survey'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
              {KIND_LABEL[k]}s ({(poolQ.data ?? []).filter((p) => p.kind === k).length})
            </label>
          ))}
          {kinds.earth_survey && regionsQ.data && (
            <details className="rounded-md border border-slate-800 p-2">
              <summary className="cursor-pointer text-xs text-slate-300">Survey regions ({regionSel === null ? 'all' : regionSel.length} selected)</summary>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs">
                {regionsQ.data.map((r) => {
                  const on = regionSel === null || regionSel.includes(r.id);
                  return (
                    <label key={r.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={on} onChange={() => {
                        const cur = regionSel ?? regionsQ.data!.map((x) => x.id);
                        const next = on ? cur.filter((x) => x !== r.id) : [...cur, r.id];
                        setRegionSel(next.length === regionsQ.data!.length ? null : next);
                      }} />
                      {r.name}
                    </label>
                  );
                })}
              </div>
            </details>
          )}
          <label className="block">
            <span className="text-xs text-slate-400">Minimum data coverage to be ranked</span>
            <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5" value={minCoverage} onChange={(e) => setMinCoverage(+e.target.value)}>
              <option value={1}>100 % (strict, default)</option>
              <option value={0.8}>80 %</option>
              <option value={0.6}>60 %</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Missing-feature penalty (IQR units)</span>
            <input type="number" min={0} max={10} step={0.5} value={penalty} onChange={(e) => setPenalty(Math.min(10, Math.max(0, +e.target.value)))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Results to return: {limit}</span>
            <input type="range" min={5} max={100} step={5} value={limit} onChange={(e) => setLimit(+e.target.value)} className="w-full accent-sky-400" />
          </label>
        </div>

        {/* Sticky so the action stays reachable however far the weight list scrolls. */}
        <div className="sticky bottom-0 -mx-1 space-y-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent px-1 pb-1 pt-3">
          {weightError && <p className="text-xs text-rose-300" role="alert">{weightError}</p>}
          <button className="btn-primary w-full py-2.5 shadow-lg shadow-sky-500/20 transition-transform hover:scale-[1.01]"
            disabled={!target || !weightsReady || running || !!weightError} onClick={runSearch}>
            {running ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/40 border-t-slate-900" />
                Searching…
              </>
            ) : 'Find Earth analogs'}
          </button>
        </div>
        {searchError && <ErrorBox message={searchError} onRetry={runSearch} />}
      </aside>

      {/* ------------------------------------------------ map + results */}
      <section className="min-w-0 space-y-4">
        <div className="h-[52vh]">
          {poolQ.loading ? <div className="card h-full"><Loading label="Loading candidate locations…" /></div> : (
            <AnalogMap pool={poolQ.data ?? []} results={res ? visible : null} excluded={res?.excluded ?? null}
              selectedId={selectedId} onSelect={setSelectedId} showExcluded={showExcluded} />
          )}
        </div>

        {!res && !running && (
          <Empty title="No search yet">
            Choose a reference region, adjust feature weights, then press <b>Find Earth analogs</b>. The map currently shows the
            {' '}{poolQ.data?.length ?? 0} Earth locations in the candidate pool (grey).
          </Empty>
        )}
        {running && <Loading label="Ranking candidates…" />}

        {res && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="card min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle sub={`${res.results.length} shown of ${res.n_candidates_considered} considered · ${res.excluded.length} not ranked`}>
                  Ranked Earth candidates for {res.target.name}
                </SectionTitle>
                <div className="flex items-center gap-2 text-xs">
                  <select aria-label="Filter results by type" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1" value={listFilter} onChange={(e) => setListFilter(e.target.value as typeof listFilter)}>
                    <option value="all">All types</option>
                    <option value="earth_named">Named sites</option>
                    <option value="earth_survey">Survey cells</option>
                  </select>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} /> show unranked</label>
                </div>
              </div>
              {res.warnings.map((w) => (
                <p key={w} className="rounded-lg border border-amber-500/25 bg-amber-950/30 p-2 text-xs text-amber-200">{w}</p>
              ))}
              {visible.length === 0 ? (
                <Empty title="No ranked candidates">No candidate met the coverage requirement with the current filters. Try lowering the minimum coverage or including more candidate types.</Empty>
              ) : (
                <ol className="max-h-[440px] space-y-1.5 overflow-y-auto pr-1" aria-label="Ranked results">
                  {visible.map((r) => {
                    const top = [...r.comparisons].sort((a, b) => b.contribution - a.contribution)[0];
                    const tone = indexColor(r.similarity_index);
                    const on = r.id === selectedId;
                    return (
                      <li key={r.id}>
                        <button onClick={() => setSelectedId(r.id)} aria-current={on}
                          className={`group relative w-full overflow-hidden rounded-lg border py-2 pl-3 pr-2 text-left transition-all duration-200 ${
                            on ? 'border-sky-400/70 bg-sky-950/40 shadow-lg shadow-sky-950/50'
                               : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}>
                          {/* Left edge carries the index colour, so the list reads
                              as a ranked gradient before any number is parsed. */}
                          <span aria-hidden className="absolute inset-y-0 left-0 w-1 transition-all duration-200 group-hover:w-1.5"
                            style={{ background: tone, opacity: on ? 1 : 0.55 }} />
                          <div className="flex items-center gap-2">
                            <span className="w-8 num text-xs text-slate-500">#{r.rank}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-100 transition-colors group-hover:text-white">{r.name}</span>
                            <span className="num text-base font-semibold text-white">{r.similarity_index.toFixed(1)}</span>
                          </div>
                          <div className="ml-10 mt-1"><IndexMeter value={r.similarity_index} color={tone} /></div>
                          <div className="ml-10 mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                            <span>{KIND_LABEL[r.kind]}</span>
                            <span>coverage {(100 * r.coverage).toFixed(0)}%</span>
                            {top && <span>largest difference: {defs[top.key]?.label ?? top.key}</span>}
                            {r.coordinate_status === 'approximate_unverified' && <span className="text-amber-300">approx. coords</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {visible.length > 0 && <RankingChart results={visible} onSelect={setSelectedId} />}
              <p className="text-[11px] text-slate-500">{res.interpretation}</p>
              {res.excluded.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-300">Not ranked ({res.excluded.length}) and why</summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-slate-400">
                    {res.excluded.map((r) => <li key={r.id}><span className="text-slate-200">{r.name}</span>: {r.exclusion_reason}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <div className="card min-w-0">
              {selected && datasetsQ.data ? (
                <CandidateDetail candidate={selected} response={res} defs={defs} datasets={datasetsQ.data.integrated}
                  inCompare={s.compareIds.includes(selected.id)} onToggleCompare={() => s.toggleCompare(selected.id)} onClose={() => setSelectedId(null)} />
              ) : (
                <Empty title="Select a candidate">Click a result or a map marker to see measurements, feature contributions, distributions and sources.</Empty>
              )}
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
