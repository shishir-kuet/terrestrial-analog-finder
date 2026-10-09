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
  const links: [string, string][] = [
    ['/', 'Home'],
    ['/explore', 'Explorer'],
    ['/compare', `Compare${compareIds.length ? ` (${compareIds.length})` : ''}`],
    ['/methodology', 'Data & methods'],
    ['/about', 'About'],
  ];
  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-2.5">
        <NavLink to="/" className="flex items-center gap-2 font-semibold text-white">
          <span aria-hidden className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-sky-300 via-slate-400 to-orange-400" />
          Terrestrial Analog Finder
        </NavLink>
        <button className="btn-ghost sm:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
        <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-full flex-col gap-1 border-b border-slate-800 bg-slate-950 p-2 sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'}`}>
              {label}
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
