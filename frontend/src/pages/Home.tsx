import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

export default function Home() {
  const h = useAsync(() => api.health(), []);
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <section className="space-y-4">
        <p className="label text-sky-300">NASA Space Apps Challenge 2026 project</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Terrestrial Analog Finder</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Find places on Earth whose <em>measured terrain</em> resembles lunar south-polar sites under study for a sustained
          Moon presence and well-studied regions of Mars, and see exactly why each place ranks where it does.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/explore" className="btn-primary px-5 py-2.5 text-base">Start exploring</Link>
          <Link to="/methodology" className="btn-ghost px-5 py-2.5 text-base">Data and methodology</Link>
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          {h.loading ? 'Checking analysis server…' : h.error ? `Analysis server unavailable: ${h.error}` : `Analysis server online · ${h.data?.locations} locations · data built ${h.data?.built_at}`}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['What is an Earth analog?', 'A place on Earth that shares measurable characteristics with a planetary surface, used to test instruments, rovers, procedures and science ideas before flying them.'],
          ['What we compare', 'Relief, slope distribution, short-baseline roughness and hypsometry of 12 km windows, measured on real elevation models (LRO LOLA, MRO CTX and Copernicus DEM) on a common 30 m grid.'],
          ['How we rank', 'A transparent weighted distance on robust-scaled features. You set the weights; every score is broken down feature by feature, and missing data is shown, never hidden.'],
        ].map(([t, b]) => (
          <div key={t} className="card"><h2 className="font-semibold text-white">{t}</h2><p className="mt-1 text-sm text-slate-300">{b}</p></div>
        ))}
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <p className="font-semibold">Scientific disclaimer</p>
        <p className="mt-1">
          A high similarity index means similar terrain statistics at the 12 km / 30 m scale, nothing more. It is not a probability,
          does not mean a place is physically identical to the Moon or Mars, and does not identify landing sites, safe habitats or
          operationally suitable locations. This is an independent hackathon project and is not affiliated with or endorsed by NASA.
        </p>
      </section>
    </div>
  );
}
