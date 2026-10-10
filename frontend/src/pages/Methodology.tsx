import type { ReactNode } from 'react';
import Reveal from '../components/Reveal';
import { ErrorBox, Loading } from '../components/StateViews';
import { api } from '../lib/api';
import { useScrollProgress, useScrollSpy } from '../lib/useScroll';
import { useAsync } from '../lib/useAsync';
import type { Dataset } from '../lib/types';

/** One tint language per planetary body, shared with the rest of the app. */
const BODY_BADGE: Record<string, string> = {
  moon: 'bg-moon/10 text-moon ring-1 ring-inset ring-moon/25',
  mars: 'bg-mars/10 text-mars ring-1 ring-inset ring-mars/25',
  earth: 'bg-earth/10 text-earth ring-1 ring-inset ring-earth/25',
};
/** Card text colour, which `.edge` reads through currentColor. */
const BODY_EDGE: Record<string, string> = { moon: 'text-moon', mars: 'text-mars', earth: 'text-earth' };

const SECTIONS: [id: string, label: string][] = [
  ['datasets', 'Datasets'],
  ['considered', 'Also considered'],
  ['method', 'Similarity method'],
  ['features', 'Features'],
  ['thermal', 'Thermal & mineral'],
  ['sensitivity', 'Sensitivity'],
  ['limitations', 'Limitations'],
];

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Section wrapper: heading, optional standfirst, and the reveal on scroll. */
function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <Reveal as="section" id={id} className="scroll-mt-24">
      <h2 className="h-section">{title}</h2>
      {lead && <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">{lead}</p>}
      <div className="mt-3">{children}</div>
    </Reveal>
  );
}

/** Label/value row for a dataset's expanded detail. */
function Spec({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{k}</dt>
      <dd className="min-w-0 break-words text-ink-muted">{children}</dd>
    </div>
  );
}

/** Proportion bar. The number stays the source of truth; this gives it scale. */
function Bar({ value, title }: { value: number; title: string }) {
  return (
    <span className="inline-flex w-full min-w-[4rem] max-w-[7rem] items-center" title={title}>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </span>
    </span>
  );
}

function DatasetCard({ x }: { x: Dataset }) {
  return (
    <details className={`edge card-flat card-hover group pl-4 ${BODY_EDGE[x.body] ?? 'text-ink-faint'}`}>
      {/* Collapsed by default: the summary already carries provider, resolution
          and licence, so eight datasets stay scannable without expanding. */}
      <summary className="flex items-start gap-2.5">
        <span className={`badge mt-0.5 shrink-0 ${BODY_BADGE[x.body] ?? 'bg-surface-sunken text-ink-muted'}`}>{x.body}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-ink">{x.name}</span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-faint">
            {x.provider} · {x.spatial_resolution}
          </span>
          <span className="mt-1 block text-[11px] text-ink-faint">{x.license}</span>
        </span>
        <span aria-hidden className="mt-0.5 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-90">›</span>
      </summary>
      <dl className="mt-3 divide-y divide-line border-t border-line pt-2 text-sm">
        <Spec k="Source"><a className="link break-all" href={x.source_url} target="_blank" rel="noreferrer">{x.source_url}</a></Spec>
        <Spec k="DOI">{x.doi ? <a className="link break-all" href={x.doi} target="_blank" rel="noreferrer">{x.doi}</a> : 'none listed'}</Spec>
        <Spec k="Citation">{x.citation}</Spec>
        <Spec k="Variables">{x.variables.join(', ')}</Spec>
        <Spec k="Units">{x.units}</Spec>
        <Spec k="Coverage">{x.spatial_coverage}</Spec>
        <Spec k="Temporal">{x.temporal_coverage}</Spec>
        <Spec k="CRS">{x.crs}</Spec>
        <Spec k="Access">{x.authentication} · {x.access_method}</Spec>
        <Spec k="Preprocessing">{x.preprocessing}</Spec>
        <Spec k="Limitations">{x.limitations}</Spec>
      </dl>
    </details>
  );
}

export default function Methodology() {
  const m = useAsync(() => api.methodology(), []);
  const d = useAsync(() => api.datasets(), []);
  const f = useAsync(() => api.features(), []);
  const e = useAsync(() => api.environment(), []);

  const active = useScrollSpy(SECTIONS.map(([id]) => id), 120);
  const progress = useScrollProgress();

  const facts: [value: string, label: string][] = [
    [d.data ? String(d.data.integrated.length) : '—', 'datasets integrated'],
    [d.data ? String(d.data.investigated_not_integrated.length) : '—', 'considered, not used'],
    [f.data ? String(f.data.features.length) : '—', 'measured features'],
    [e.data ? String(e.data.earth_windows_ok) : '—', 'complete Earth windows'],
    [m.data?.sensitivity ? String(m.data.sensitivity.experiments.length) : '—', 'robustness checks'],
  ];

  const thermalPct = e.data && e.data.earth_windows_ok
    ? e.data.earth_windows_with_thermal_feature / e.data.earth_windows_ok : 0;
  const mineralPct = e.data && e.data.earth_windows_ok
    ? e.data.earth_windows_with_mineral_classes / e.data.earth_windows_ok : 0;

  return (
    <div className="pb-section-lg">
      <div className="progress-rail" aria-hidden>
        <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* ------------------------------------------------------------ masthead */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-4 py-7 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="max-w-prose">
              <p className="label text-accent-ink">Reproducible by design</p>
              <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Data and methodology</h1>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">
                Everything the ranking depends on, served live from the analysis backend. No figure on this page is
                typed by hand.
              </p>
            </div>
            {m.data?.manifest?.built_at && (
              <dl className="shrink-0 rounded-lg border border-line bg-surface-raised px-3 py-2">
                <dt className="label">Data build</dt>
                <dd className="num mt-0.5 text-sm text-ink">{String(m.data.manifest.built_at).slice(0, 10)}</dd>
              </dl>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {facts.map(([v, l], i) => (
              <Reveal key={l} delay={i * 40} className="fact">
                <dd className="fact-n">{v}</dd>
                <dt className="fact-l">{l}</dt>
              </Reveal>
            ))}
          </dl>
        </div>
      </header>

      {/* Mobile section nav. On desktop this lives in the sticky rail instead. */}
      <nav aria-label="Sections" className="sticky top-[49px] z-20 border-b border-line bg-base/85 backdrop-blur lg:hidden">
        <ul className="flex gap-1.5 overflow-x-auto px-4 py-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              {/* A plain `#id` href would overwrite the HashRouter route and land
                  on "page not found", so scroll the section into view instead. */}
              <button aria-current={active === id ? 'true' : undefined}
                onClick={() => jump(id)} className={`pill ${active === id ? 'pill-on' : ''}`}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------- rail + single reading column */}
      <div className="mx-auto grid max-w-content gap-x-10 px-4 py-section sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 border-l border-line">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <button
                  aria-current={active === id ? 'true' : undefined}
                  onClick={() => jump(id)}
                  className={`-ml-px block w-full border-l-2 py-1.5 pl-3 text-left text-sm transition-colors duration-150 ${
                    active === id
                      ? 'border-accent font-medium text-ink'
                      : 'border-transparent text-ink-faint hover:border-line-strong hover:text-ink'
                  }`}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-section">
          {/* -------------------------------------------------------- datasets */}
          <Section id="datasets" title="Datasets integrated"
            lead="Every archive the build actually reads. Open one for its citation, licence, CRS and preprocessing.">
            {d.loading && <Loading />}
            {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
            <div className="grid gap-2.5 md:grid-cols-2">
              {d.data?.integrated.map((x) => <DatasetCard key={x.id} x={x} />)}
            </div>
          </Section>

          {/* ------------------------------------------------------ considered */}
          <Section id="considered" title="Other sources considered"
            lead="Investigated during the build and deliberately left out, with the reason and what each would have added.">
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="tbl">
                <thead><tr><th className="w-56">Source</th><th className="w-40">Status</th><th>Would provide</th></tr></thead>
                <tbody>
                  {d.data?.investigated_not_integrated.map((x) => (
                    <tr key={x.name}>
                      <td><a className="link" href={x.url} target="_blank" rel="noreferrer">{x.name}</a></td>
                      <td className="text-ink-faint">{x.status}</td>
                      <td>{x.would_provide}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ---------------------------------------------------------- method */}
          <Section id="method" title="Similarity method" lead={m.data?.summary}>
            {m.loading && <Loading />}
            {m.error && <ErrorBox message={m.error} onRetry={m.reload} />}
            {m.data && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3 text-sm leading-relaxed">
                  <div>
                    <p className="label mb-1">Window</p>
                    <p>
                      {m.data.window.size_m / 1000} km × {m.data.window.size_m / 1000} km on a {m.data.window.grid_res_m} m
                      grid, {m.data.window.projection}. Windows with under {100 * m.data.window.min_valid_fraction}% valid
                      cells are not scored.
                    </p>
                  </div>
                  <div>
                    <p className="label mb-1">Normalisation</p>
                    <p>{m.data.normalization}</p>
                  </div>
                  <div>
                    <p className="label mb-1">Missing data</p>
                    <p>{m.data.missing_data_policy}</p>
                  </div>
                  <div>
                    <p className="label mb-1">Weights</p>
                    <p>{m.data.weights}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <figure>
                    <figcaption className="label mb-1">The score, in full</figcaption>
                    <pre className="overflow-x-auto rounded-lg border border-line bg-surface-raised p-3 font-mono text-[11px] leading-relaxed text-ink">
{`d_i = (T_i(candidate) − T_i(reference)) / IQR_i
      (scalar features)

d_i = W1(slope_hist_cand, slope_hist_ref) / IQR_slope
      (distribution feature)

${m.data.distance}
${m.data.similarity_index}`}
                    </pre>
                  </figure>
                  <p className="note-warn">{m.data.interpretation}</p>
                </div>
              </div>
            )}
          </Section>

          {/* -------------------------------------------------------- features */}
          <Section id="features" title="Features"
            lead="What is measured on every window, how, and the robust scale each difference is divided by.">
            {f.error && <ErrorBox message={f.error} />}
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-line bg-surface">
              <table className="tbl tbl-sticky">
                <thead>
                  <tr>
                    <th className="w-44">Feature</th><th>Meaning</th><th>Method</th>
                    <th className="w-40">Transform · IQR</th><th>Limitations</th>
                  </tr>
                </thead>
                <tbody>
                  {f.data?.features.map((x) => (
                    <tr key={x.key}>
                      <td className="font-medium text-ink">
                        {x.label}
                        <span className="mt-0.5 block text-[10px] font-normal text-ink-faint">{x.unit}</span>
                      </td>
                      <td>{x.meaning}</td>
                      <td>{x.method}</td>
                      <td className="num text-xs">
                        {x.transform}{x.transform === 'log10' ? `(x+${x.log_offset})` : ''}
                        <span className="block text-ink-faint">{f.data!.scales[x.key]?.toFixed(3)}</span>
                      </td>
                      <td className="text-ink-faint">{x.limitations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* --------------------------------------------------------- thermal */}
          <Section id="thermal" title="Thermal and mineral layer"
            lead="Built separately from the terrain layer and merged onto each location, because coverage is uneven by nature.">
            {e.loading && <Loading />}
            {e.error && <ErrorBox message={e.error} onRetry={e.reload} />}
            {e.data && (
              <div className="space-y-4">
                {/* Coverage is the thing people get wrong about this layer, so
                    show it as a proportion rather than burying it in a sentence. */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {([
                    ['Thermal measurement', e.data.earth_windows_with_thermal_feature, thermalPct],
                    ['Mineral classes', e.data.earth_windows_with_mineral_classes, mineralPct],
                  ] as [string, number, number][]).map(([label, n, pct]) => (
                    <div key={label} className="card-flat">
                      <p className="label">{label}</p>
                      <p className="mt-1 flex items-baseline gap-1.5">
                        <span className="num text-2xl font-semibold text-ink">{n}</span>
                        <span className="text-sm text-ink-faint">of {e.data!.earth_windows_ok} Earth windows</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Bar value={pct} title={`${(100 * pct).toFixed(0)}% coverage`} />
                        <span className="num text-xs text-ink-faint">{(100 * pct).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="max-w-prose space-y-2 text-sm leading-relaxed">
                  <p>
                    <span className="font-medium text-ink">Comparable across bodies:</span>{' '}
                    {e.data.comparable_features.join(', ') || 'none'}. Its default weight is 0, so the terrain-only
                    ranking is unchanged unless you switch it on.
                  </p>
                  <p className="text-ink-faint">{e.data.display_only}</p>
                </div>

                <details className="card-flat text-sm">
                  <summary className="flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink">
                    <span aria-hidden className="text-ink-faint">›</span>
                    Build parameters and percentile references
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded border border-line bg-surface-raised p-2 font-mono text-[11px] leading-relaxed text-ink-muted">
                    {JSON.stringify({ parameters: e.data.parameters, percentile_reference: e.data.percentile_reference }, null, 1)}
                  </pre>
                </details>
              </div>
            )}
          </Section>

          {/* ----------------------------------------------------- sensitivity */}
          {m.data?.sensitivity && (
            <Section id="sensitivity" title="Sensitivity analysis" lead={m.data.sensitivity.description}>
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Perturbation</th>
                      <th className="w-52">Spearman ρ vs baseline</th>
                      <th className="w-32">Top-10 overlap</th>
                      <th className="w-20">Targets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.data.sensitivity.experiments.map(
                      (x: { name: string; median_spearman: number; median_top10_overlap: number; n_targets: number }) => (
                        <tr key={x.name}>
                          <td className="text-ink">{x.name}</td>
                          <td>
                            <span className="flex items-center gap-2">
                              <Bar value={x.median_spearman} title={`rho ${x.median_spearman.toFixed(3)}`} />
                              <span className="num text-xs text-ink">{x.median_spearman.toFixed(3)}</span>
                            </span>
                          </td>
                          <td className="num text-xs">{x.median_top10_overlap.toFixed(1)} / 10</td>
                          <td className="num text-xs">{x.n_targets}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ----------------------------------------------------- limitations */}
          <Section id="limitations" title="Scientific limitations"
            lead="What this ranking does not tell you. None of these are hidden elsewhere in the app.">
            <ol className="grid gap-2.5 md:grid-cols-2">
              {[
                'The default ranking compares terrain geometry only. Thermophysical character enters only through the thermal-inertia percentile, which is off by default; atmosphere, gravity, radiation, illumination and regolith depth are never represented.',
                "The thermal-inertia percentile compares ranks, not physical values: Earth's apparent thermal inertia (K⁻¹, from ECOSTRESS and VIIRS) and Mars' TES thermal inertia (tiu) are different quantities, and matching their within-body percentiles assumes the two distributions correspond. Earth percentiles are relative to this app's arid/volcanic/polar pool, not to Earth as a whole, and the Moon has no thermal-inertia product in the archives reachable here.",
                'EMIT mineral identifications are per-pixel spectral-library matches grouped into classes by this project, available only where EMIT has flown; they have no planetary counterpart in this build, so they are shown but never scored.',
                'All features are scale-dependent; results apply to 12 km windows on a 30 m grid only.',
                'Earth heights come from a surface model (vegetation, buildings, ice surfaces included); lunar and Martian DTMs are bare-surface products with their own interpolation and stereo noise. Short-baseline roughness is the most affected feature.',
                'Planetary targets are limited to products in the USGS analysis-ready archive: 8 lunar south-polar sites and 4 Martian CTX DTM windows.',
                'Named analog site coordinates are approximate and unverified; survey cells are a coarse, regionally limited grid, not a global search.',
                'Robust scales depend on the Earth reference pool, so indices are only comparable within one data build and configuration.',
                'The similarity index is not a probability and says nothing about landing safety, habitability or mission suitability.',
              ].map((text, i) => (
                <li key={i} className="card-flat flex gap-2.5 text-sm leading-relaxed">
                  <span aria-hidden className="num shrink-0 text-xs font-semibold text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
