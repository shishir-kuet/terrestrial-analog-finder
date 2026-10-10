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
    <header className="sticky top-0 z-[1100] border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2.5">
        <NavLink to="/" className="group flex items-center gap-2 font-semibold text-white">
          <span aria-hidden
            className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-sky-300 via-slate-400 to-orange-400 shadow-[0_0_14px_rgba(56,189,248,0.45)] transition-transform duration-500 group-hover:rotate-180" />
          <span className="transition-colors group-hover:text-sky-200">Terrestrial Analog Finder</span>
        </NavLink>
        <button className="btn-ghost sm:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
        <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-full flex-col gap-1 border-b border-slate-800 bg-slate-950 p-2 sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0`}>
          {links.map(([to, label, badge]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `relative rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}>
              {({ isActive }) => (
                <>
                  {label}
                  {badge !== undefined && (
                    <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">{badge}</span>
                  )}
                  {/* Underline rather than a filled pill: it survives the badge
                      and keeps the bar quiet while still marking the page. */}
                  {isActive && (
                    <span aria-hidden className="absolute inset-x-2 -bottom-px hidden h-0.5 rounded-full bg-sky-400 sm:block" />
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
            <Route path="*" element={<p className="p-6 text-slate-300">Page not found.</p>} />
          </Routes>
        </main>
      </HashRouter>
    </SearchProvider>
  );
}
