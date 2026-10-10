import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

const STACK: [area: string, items: string[]][] = [
  ['Data pipeline', ['Python', 'rasterio / GDAL', 'NumPy', 'offline + cached']],
  ['API', ['FastAPI', 'Pydantic']],
  ['Frontend', ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Leaflet', 'Recharts']],
  ['Tests', ['pytest', 'Vitest', 'Testing Library']],
];

const CREDITS: [body: string, tint: string, title: string, text: string][] = [
  ['Moon', 'text-moon', 'Lunar DTMs',
    'Barker et al., LRO LOLA; analysis-ready data by USGS Astrogeology (CC0, doi:10.5066/P13YV93V).'],
  ['Mars', 'text-mars', 'Martian DTMs',
    'MRO CTX stereo DTMs by USGS Astrogeology (CC0).'],
  ['Earth', 'text-earth', 'Earth DEM',
    'Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.'],
  ['Basemap', 'text-ink-faint', 'Basemap tiles',
    '© OpenStreetMap contributors, rendered by CARTO.'],
];

/** Rail heading for the page's lower sections. */
function Head({ title, lead }: { title: string; lead?: string }) {
  return (
    <div>
      <h2 className="h-section">{title}</h2>
      {lead && <p className="mt-1.5 text-sm leading-relaxed text-ink-faint">{lead}</p>}
    </div>
  );
}

export default function About() {
  const health = useAsync(() => api.health(), []);
  const datasets = useAsync(() => api.datasets(), []);

  const facts: [value: string, label: string][] = [
    [health.data ? health.data.locations.toLocaleString() : '—', 'locations measured'],
    ['12', 'planetary references'],
    [datasets.data ? String(datasets.data.integrated.length) : '—', 'public datasets'],
    ['30 m', 'common analysis grid'],
  ];

  return (
    <div className="pb-section-lg">
      {/* ------------------------------------------------------------ masthead */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-4 py-section sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
            <div className="max-w-prose">
              <p className="label text-accent-ink">NASA Space Apps Challenge 2026</p>
              <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                A measured answer to a question usually settled by reputation
              </h1>
              <p className="mt-3 text-base leading-relaxed text-ink-muted">
                Analog site selection leans on expert judgement: the Atacama, Haughton Crater, Devon Island.
                Terrestrial Analog Finder replaces that step with measurement, and shows its working at every stage.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to="/explore" className="btn-primary px-4 py-2">Open the Explorer</Link>
                <Link to="/methodology" className="btn-ghost px-4 py-2">Data and methodology</Link>
              </div>
            </div>

            {/* The team is what this page exists to carry, so it is the second
                visual anchor rather than a footnote at the bottom. */}
            <aside className="rounded-lg border border-line bg-surface-raised p-5">
              <p className="label">Built by</p>
              <p className="mt-1.5 text-3xl font-semibold tracking-tight text-ink">ghostblood</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                An independent team entry. Not affiliated with or endorsed by NASA, ESA or USGS.
              </p>
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                Individual member names are not listed yet. Add them here and on the team's Members tab —
                Global Judging requires every member to be registered and listed.
              </p>
            </aside>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {facts.map(([v, l], i) => (
              <Reveal key={l} delay={i * 40} className="fact">
                <dd className="fact-n">{v}</dd>
                <dt className="fact-l">{l}</dt>
              </Reveal>
            ))}
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-content space-y-section px-4 py-section sm:px-6">
        {/* ------------------------------------------------------- the project */}
        <Reveal as="section" className="grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Head title="The project" />
          <div className="max-w-prose space-y-3 text-[15px] leading-relaxed text-ink-muted">
            <p>
              Terrestrial Analog Finder was built for the NASA Space Apps Challenge 2026 challenge on identifying
              Earth locations that are analogs of candidate permanent Moon base locations and of Mars. It focuses on
              one defensible slice of that question — terrain geometry — and makes every step of the comparison
              inspectable.
            </p>
            <p>
              Every 12 km window on all three bodies is resampled to the same 30 m grid and described by the same
              statistics, so a lunar window and an Antarctic window are compared like with like. The score is a
              transparent weighted distance you can re-derive by hand: no model, no training data, no black box.
              Missing measurements are named and penalised, never filled in with a zero.
            </p>
          </div>
        </Reveal>

        {/* -------------------------------------------------- challenge context */}
        <Reveal as="section" className="grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Head title="Challenge relevance" />
          <div className="max-w-prose space-y-4">
            <p className="text-[15px] leading-relaxed text-ink-muted">
              The lunar references are LOLA terrain models of south-polar regions such as Connecting ridge,
              Shackleton rim, Malapert massif and Leibnitz beta plateau, which are discussed as candidate regions for
              sustained surface activity. The Martian references are CTX terrain models around well-studied landing
              regions.
            </p>
            <p className="note-warn">
              The official challenge page could not be accessed from the build environment, so official rules and
              deliverables are listed as unverified in the project documentation.
            </p>
          </div>
        </Reveal>

        {/* ----------------------------------------------------------- the stack */}
        <Reveal as="section" className="grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Head title="Technology" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {STACK.map(([area, items]) => (
              <div key={area} className="card-flat">
                <p className="label">{area}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((i) => <li key={i} className="chip">{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        {/* --------------------------------------------------------- attribution */}
        <Reveal as="section" className="grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Head title="Data credits" lead="Licences, DOIs and preprocessing per dataset are served live on the methodology page." />
          <div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {CREDITS.map(([body, tint, title, text]) => (
                <div key={title} className={`edge card-flat card-hover pl-4 ${tint}`}>
                  <p className="label">{body}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Full catalogue on the <Link to="/methodology" className="link">Data and methodology</Link> page.
            </p>
          </div>
        </Reveal>

        <p className="border-t border-line pt-5 text-center text-xs text-ink-faint">
          Independent hackathon project · not affiliated with or endorsed by NASA, ESA or USGS
        </p>
      </div>
    </div>
  );
}
