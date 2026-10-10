import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, hillshadeUrl } from '../lib/api';
import { fmtCoord, fmtValue } from '../lib/format';
import { useSearch } from '../lib/SearchContext';
import { useAsync } from '../lib/useAsync';
import type { Dataset, FeatureDef, Target } from '../lib/types';

const SPOTLIGHT_MS = 6000;

/** Headline terrain numbers shown on the spotlight card, in display order. */
const SPOTLIGHT_FEATURES: [key: string, label: string][] = [
  ['local_relief_m', 'Local relief'],
  ['slope_median_deg', 'Median slope'],
  ['roughness_rms_m', 'Roughness'],
];

const BODY_STYLE: Record<string, { label: string; tone: string; glow: string }> = {
  moon: { label: 'Moon', tone: 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30', glow: 'from-sky-500/20' },
  mars: { label: 'Mars', tone: 'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30', glow: 'from-orange-500/20' },
};

/** Ambient backdrop: two slowly drifting glows behind the hero. Decorative only. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="drift absolute -left-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />
      <div className="drift absolute -right-32 top-10 h-[32rem] w-[32rem] rounded-full bg-orange-500/[0.07] blur-3xl"
        style={{ animationDelay: '-11s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.07),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
    </div>
  );
}

/** Live connection state for the analysis server, as a single quiet line. */
function ServerStatus({ loading, error, locations, builtAt }: {
  loading: boolean; error: string | null; locations?: number; builtAt?: string;
}) {
  const tone = loading ? 'bg-slate-500' : error ? 'bg-rose-400' : 'bg-emerald-400';
  const text = loading
    ? 'Contacting analysis server…'
    : error
      ? `Analysis server unavailable — ${error}`
      : `Analysis server online · ${locations} locations · data built ${builtAt?.slice(0, 10)}`;
  return (
    <p className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
      <span className={`live-dot ${tone}`} />
      {text}
    </p>
  );
}

/**
 * Auto-advancing spotlight over the planetary reference sites.
 *
 * The hillshade is a real render of the measured window, so this doubles as
 * proof the data build is live rather than a static marketing image. Rotation
 * stops while the pointer or keyboard focus is inside the card, and the
 * prefers-reduced-motion check keeps it from ever advancing on its own.
 */
function TargetSpotlight({ targets, defs }: { targets: Target[]; defs: Record<string, FeatureDef> }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const nav = useNavigate();
  const { setBody, setTargetId } = useSearch();

  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (held || reduced || targets.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % targets.length), SPOTLIGHT_MS);
    return () => clearInterval(t);
  }, [held, reduced, targets.length]);

  if (!targets.length) return null;
  const t = targets[i % targets.length];
  const body = BODY_STYLE[t.body] ?? { label: t.body, tone: 'bg-slate-700 text-slate-300', glow: 'from-slate-500/20' };

  const analyse = () => {
    if (t.body === 'moon' || t.body === 'mars') setBody(t.body);
    setTargetId(t.id);
    nav('/explore');
  };

  return (
    <div
      className="card relative overflow-hidden p-0"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${body.glow} to-transparent`} />
      <div className="relative aspect-[16/10] w-full bg-slate-950">
        {t.hillshade ? (
          <img
            key={t.id}
            src={hillshadeUrl(t.id)}
            alt={`Hillshade of the 12 km measurement window at ${t.name}`}
            className="fade h-full w-full object-cover opacity-90"
            loading="eager"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-slate-600">no hillshade render</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <span className={`badge absolute left-3 top-3 ${body.tone}`}>{body.label}</span>
      </div>

      <div className="relative -mt-10 space-y-3 p-4">
        <div>
          <p className="label">Planetary reference site</p>
          <h2 className="text-lg font-semibold text-white">{t.name}</h2>
          <p className="font-mono text-xs text-slate-400">{fmtCoord(t.lat, t.lon)}</p>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {SPOTLIGHT_FEATURES.map(([key, label]) => (
            <div key={key} className="rounded-lg bg-slate-950/60 px-2 py-1.5">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="text-sm font-semibold text-slate-100">
                {fmtValue(t.features?.[key], defs[key])}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center justify-between gap-3">
          <button className="btn-primary" onClick={analyse}>Find Earth analogs</button>
          <div className="flex flex-wrap items-center justify-end gap-1" role="tablist" aria-label="Choose a reference site">
            {targets.map((x, n) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={n === i}
                aria-label={x.name}
                title={x.name}
                onClick={() => setI(n)}
                className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-sky-400' : 'w-1.5 bg-slate-700 hover:bg-slate-500'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stat tile. The value stays in primary ink and uses proportional figures —
 * these are standalone numbers, not a column that has to align.
 */
function Stat({ label, value, note, loading }: { label: string; value: string; note: string; loading: boolean }) {
  return (
    <div className="card card-hover">
      <p className="label">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-white">
        {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-slate-800 align-middle" /> : value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

const STEPS: [string, string, string][] = [
  ['Pick a reference site', 'Eight lunar south-polar sites under study for a sustained Moon presence, and four well-characterised regions of Mars.', 'Measured from LRO LOLA and MRO CTX elevation models.'],
  ['Set what matters', 'Weight relief, slope, roughness and hypsometry yourself. Nothing is weighted for you behind the scenes.', 'Weights are reported back, normalised, with every result.'],
  ['Read why it ranked', 'Each score breaks down feature by feature, with the share each one contributed and every missing measurement named.', 'No score is a black box and no gap is filled with a zero.'],
];

export default function Home() {
  const health = useAsync(() => api.health(), []);
  const targets = useAsync(() => api.targets(), []);
  const regions = useAsync(() => api.regions(), []);
  const datasets = useAsync(() => api.datasets(), []);
  const feats = useAsync(() => api.features(), []);
  const env = useAsync(() => api.environment(), []);

  const ts = targets.data ?? [];
  const moonN = ts.filter((t) => t.body === 'moon').length;
  const marsN = ts.filter((t) => t.body === 'mars').length;
  const earthN = health.data ? health.data.locations - ts.length : null;

  const byBody = (datasets.data?.integrated ?? []).reduce<Record<string, Dataset[]>>((acc, d) => {
    (acc[d.body] ??= []).push(d);
    return acc;
  }, {});

  const allFeatures: FeatureDef[] = feats.data?.features ?? [];
  const scored = allFeatures.filter((f) => f.default_weight > 0);
  const featureDefs = Object.fromEntries(allFeatures.map((f) => [f.key, f]));

  return (
    <div className="pb-16">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate border-b border-slate-800/80">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div className="rise space-y-5">
            <p className="label inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-sky-300 ring-1 ring-inset ring-sky-500/20">
              NASA Space Apps Challenge 2026
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="headline-gradient">Where on Earth</span>
              <br />
              <span className="text-white">looks like the Moon?</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              Terrestrial Analog Finder ranks real places on Earth by how closely their{' '}
              <em className="not-italic text-slate-100">measured terrain</em> matches lunar south-polar sites and
              well-studied regions of Mars — and shows you, feature by feature, exactly why each one ranks where it does.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/explore" className="btn-primary px-5 py-2.5 text-base">Start exploring</Link>
              <Link to="/methodology" className="btn-ghost px-5 py-2.5 text-base">Data and methodology</Link>
            </div>
            <ServerStatus
              loading={health.loading}
              error={health.error}
              locations={health.data?.locations}
              builtAt={health.data?.built_at}
            />
          </div>

          <div className="rise" style={{ animationDelay: '120ms' }}>
            {targets.loading ? (
              <div className="card aspect-[16/13] animate-pulse bg-slate-900/70" />
            ) : (
              <TargetSpotlight targets={ts} defs={featureDefs} />
            )}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="mx-auto max-w-6xl px-4 py-10" aria-label="Dataset at a glance">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Earth candidates"
            value={earthN?.toLocaleString() ?? '—'}
            note={`${env.data?.earth_windows_ok ?? '—'} with a complete terrain window`}
            loading={health.loading || targets.loading}
          />
          <Stat
            label="Reference sites"
            value={ts.length ? String(ts.length) : '—'}
            note={`${moonN} lunar · ${marsN} Martian`}
            loading={targets.loading}
          />
          <Stat
            label="Survey regions"
            value={regions.data ? String(regions.data.length) : '—'}
            note="Systematic grids across six continents"
            loading={regions.loading}
          />
          <Stat
            label="Source datasets"
            value={datasets.data ? String(datasets.data.integrated.length) : '—'}
            note="All public, cited and version-pinned"
            loading={datasets.loading}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ how */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-2xl font-semibold text-white">How the ranking works</h2>
        <p className="mt-1 max-w-2xl text-slate-400">
          Three steps, no hidden model. Every number on the results page traces back to a measurement you can inspect.
        </p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, body, foot], n) => (
            <li key={title} className="card card-hover relative overflow-hidden">
              <span aria-hidden className="absolute -right-3 -top-5 font-mono text-7xl font-bold text-slate-100/[0.04]">
                {n + 1}
              </span>
              <div className="relative">
                <p className="label text-sky-300">Step {n + 1}</p>
                <h3 className="mt-1 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
                <p className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-500">{foot}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-white">What actually gets compared</h2>
            <Link to="/methodology" className="link text-sm">Full definitions →</Link>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            12 km × 12 km windows resampled to a common 30 m grid, so a lunar window and an Earth window are measured
            the same way before anything is compared.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Features used in scoring">
            {feats.loading
              ? Array.from({ length: 6 }, (_, k) => (
                  <li key={k} className="h-7 w-32 animate-pulse rounded-full bg-slate-800" />
                ))
              : scored.map((f) => (
                  <li
                    key={f.key}
                    title={f.meaning}
                    className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-sm text-slate-200"
                  >
                    {f.label}
                    {f.unit && f.unit !== 'dimensionless' && (
                      <span className="ml-1.5 text-xs text-slate-500">{f.unit}</span>
                    )}
                  </li>
                ))}
          </ul>
          {env.data && (
            <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
              A separate thermal and mineral layer (ECOSTRESS, VIIRS, EMIT, TES and Diviner) is attached to each
              location — {env.data.earth_windows_with_thermal_feature} Earth windows carry a thermal measurement and{' '}
              {env.data.earth_windows_with_mineral_classes} carry mineral classes. Only{' '}
              {env.data.comparable_features.join(', ')} is comparable across bodies, and it is weighted 0 by default,
              so the terrain ranking is unchanged unless you switch it on.
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- sources */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-xl font-semibold text-white">Built on public mission data</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(['moon', 'mars', 'earth'] as const).map((b) => (
            <div key={b} className="card card-hover">
              <p className="label">{b === 'earth' ? 'Earth' : BODY_STYLE[b].label}</p>
              <ul className="mt-2 space-y-2">
                {datasets.loading
                  ? [0, 1].map((k) => <li key={k} className="h-4 animate-pulse rounded bg-slate-800" />)
                  : (byBody[b] ?? []).map((d) => (
                      <li key={d.id} className="text-sm leading-snug text-slate-300">
                        <a href={d.source_url} target="_blank" rel="noreferrer noopener" className="link">
                          {d.name}
                        </a>
                        <span className="block text-xs text-slate-500">{d.spatial_resolution}</span>
                      </li>
                    ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ disclaimer */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          <p className="font-semibold">Scientific disclaimer</p>
          <p className="mt-1 leading-relaxed">
            A high similarity index means similar terrain statistics at the 12 km / 30 m scale, nothing more. It is not
            a probability, does not mean a place is physically identical to the Moon or Mars, and does not identify
            landing sites, safe habitats or operationally suitable locations. This is an independent hackathon project
            and is not affiliated with or endorsed by NASA.
          </p>
        </div>
      </section>
    </div>
  );
}
