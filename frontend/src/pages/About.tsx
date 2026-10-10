import { Link } from 'react-router-dom';
import { PageHeader } from '../components/StateViews';

const STACK: [area: string, items: string[]][] = [
  ['Data pipeline', ['Python', 'rasterio / GDAL', 'NumPy', 'offline + cached']],
  ['API', ['FastAPI', 'Pydantic']],
  ['Frontend', ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Leaflet', 'Recharts']],
  ['Tests', ['pytest', 'Vitest', 'Testing Library']],
];

const CREDITS: [body: string, tone: string, title: string, text: string][] = [
  ['Moon', 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30', 'Lunar DTMs',
    'Barker et al., LRO LOLA; analysis-ready data by USGS Astrogeology (CC0, doi:10.5066/P13YV93V).'],
  ['Mars', 'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30', 'Martian DTMs',
    'MRO CTX stereo DTMs by USGS Astrogeology (CC0).'],
  ['Earth', 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30', 'Earth DEM',
    'Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.'],
  ['Basemap', 'bg-slate-700 text-slate-300', 'Basemap', '© OpenStreetMap contributors.'],
];

export default function About() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="NASA Space Apps Challenge 2026"
        title="About this project"
        aside={<Link to="/explore" className="btn-primary">Open the Explorer →</Link>}
      >
        One defensible slice of a large question — terrain geometry — with every step of the comparison left open to inspection.
      </PageHeader>

      <div className="mx-auto max-w-5xl space-y-5 p-4">
        <section className="card rise text-sm leading-relaxed text-slate-300">
          <p>
            Terrestrial Analog Finder was built for the NASA Space Apps Challenge 2026 challenge on identifying Earth
            locations that are analogs of candidate permanent Moon base locations and of Mars. It focuses on one
            defensible slice of that question, terrain geometry, and makes every step of the comparison inspectable.
          </p>
        </section>

        <section className="card rise" style={{ animationDelay: '60ms' }}>
          <h2 className="rule-left text-lg font-semibold text-white">Challenge relevance</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            The lunar references are LOLA terrain models of south-polar regions such as Connecting ridge, Shackleton rim,
            Malapert massif and Leibnitz beta plateau, which are discussed as candidate regions for sustained surface
            activity. The Martian references are CTX terrain models around well-studied landing regions.
          </p>
          <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 text-sm text-amber-100/90">
            The official challenge page could not be accessed from the build environment, so official rules and
            deliverables are listed as unverified in the project documentation.
          </p>
        </section>

        <section className="rise" style={{ animationDelay: '120ms' }}>
          <h2 className="rule-left text-lg font-semibold text-white">Technology</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {STACK.map(([area, items]) => (
              <div key={area} className="card card-hover">
                <p className="label">{area}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((i) => (
                    <li key={i}
                      className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-0.5 text-xs text-slate-300 transition-colors duration-150 hover:border-sky-500/50 hover:text-sky-200">
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rise" style={{ animationDelay: '180ms' }}>
          <h2 className="rule-left text-lg font-semibold text-white">Data credits</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {CREDITS.map(([body, tone, title, text]) => (
              <div key={title} className="card card-hover">
                <p className="flex items-center gap-2">
                  <span className={`badge ${tone}`}>{body}</span>
                  <span className="font-medium text-slate-100">{title}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Per-dataset licences, DOIs and preprocessing are listed on the{' '}
            <Link to="/methodology" className="link">Data and methodology</Link> page, served live from the backend.
          </p>
        </section>

        <section className="card rise" style={{ animationDelay: '240ms' }}>
          <h2 className="rule-left text-lg font-semibold text-white">The team</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-gradient-to-br from-sky-500/20 to-orange-500/10 px-4 py-2 text-xl font-bold tracking-tight text-white ring-1 ring-inset ring-sky-500/30">
              ghostblood
            </span>
            <span className="text-sm text-slate-400">NASA Space Apps Challenge 2026</span>
          </div>
          <p className="mt-3 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
            Individual member names are not listed yet. Add them here, and on the team's Members tab on
            spaceappschallenge.org — Global Judging requires every member to be registered and listed.
          </p>
        </section>

        <p className="text-center text-xs text-slate-500">Not affiliated with or endorsed by NASA, ESA or USGS.</p>
      </div>
    </div>
  );
}
