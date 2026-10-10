import { useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { SearchProvider, useSearch } from './lib/SearchContext';
import About from './pages/About';
import Compare from './pages/Compare';
import Explorer from './pages/Explorer';
import Home from './pages/Home';
import Methodology from './pages/Methodology';

function Nav() {
  const { compareIds } = useSearch();
  const [open, setOpen] = useState(false);
  const links: [to: string, label: string, badge?: number][] = [
    ['/', 'Home'],
    ['/explore', 'Explorer'],
    ['/compare', 'Compare', compareIds.length || undefined],
    ['/methodology', 'Data & methods'],
    ['/about', 'About'],
  ];
  return (
    <header className="on-dark sticky top-0 z-[1100] border-b border-line/80 bg-base/90 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-2.5">
        <NavLink to="/" className="group flex items-center gap-2 font-semibold text-ink">
          <span aria-hidden
            className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-moon via-earth to-mars shadow-card transition-transform duration-500 group-hover:rotate-180" />
          <span className="transition-colors group-hover:text-accent">Terrestrial Analog Finder</span>
        </NavLink>
        <button className="btn-ghost sm:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
        <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-full flex-col gap-1 border-b border-line bg-base p-2 sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0`}>
          {links.map(([to, label, badge]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `relative rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                  isActive ? 'text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink'
                }`}>
              {({ isActive }) => (
                <>
                  {label}
                  {badge !== undefined && (
                    <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">{badge}</span>
                  )}
                  {/* Underline rather than a filled pill: it survives the badge
                      and keeps the bar quiet while still marking the page. */}
                  {isActive && (
                    <span aria-hidden className="absolute inset-x-2 -bottom-px hidden h-0.5 rounded-full bg-accent sm:block" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

/**
 * Closing band. Carries the standing disclaimer so individual pages do not
 * each have to repeat it, and gives every page a defined end.
 */
function Footer() {
  return (
    <footer className="on-dark mt-16 border-t border-line">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-prose">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full bg-gradient-to-br from-moon via-earth to-mars" />
            Terrestrial Analog Finder
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
            Similar terrain statistics at the 12 km / 30 m scale — never a landing site or a habitability judgement.
            Independent hackathon project by team ghostblood; not affiliated with or endorsed by NASA, ESA or USGS.
          </p>
        </div>
        <nav aria-label="Footer" className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          {[['/explore', 'Explorer'], ['/methodology', 'Data & methods'], ['/about', 'About']].map(([to, label]) => (
            <NavLink key={to} to={to} className="text-ink-faint transition-colors hover:text-accent">{label}</NavLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <SearchProvider>
      <HashRouter>
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explorer />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<p className="p-6 text-ink-muted">Page not found.</p>} />
          </Routes>
        </main>
        <Footer />
      </HashRouter>
    </SearchProvider>
  );
}
