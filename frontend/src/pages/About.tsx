export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 text-sm text-slate-300">
      <h1 className="text-2xl font-semibold text-white">About</h1>
      <p>
        Terrestrial Analog Finder was built for the NASA Space Apps Challenge 2026 challenge on identifying Earth locations that
        are analogs of candidate permanent Moon base locations and of Mars. It focuses on one defensible slice of that question,
        terrain geometry, and makes every step of the comparison inspectable.
      </p>
      <h2 className="pt-2 text-lg font-semibold text-white">Challenge relevance</h2>
      <p>
        The lunar references are LOLA terrain models of south-polar regions such as Connecting ridge, Shackleton rim, Malapert massif
        and Leibnitz beta plateau, which are discussed as candidate regions for sustained surface activity. The Martian references
        are CTX terrain models around well-studied landing regions. The official challenge page could not be accessed from the build
        environment, so official rules and deliverables are listed as unverified in the project documentation.
      </p>
      <h2 className="pt-2 text-lg font-semibold text-white">Technology</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Data pipeline: Python, rasterio/GDAL, NumPy (offline, cached)</li>
        <li>API: FastAPI + Pydantic</li>
        <li>Frontend: React, TypeScript, Vite, Tailwind CSS, Leaflet, Recharts</li>
        <li>Tests: pytest, Vitest + Testing Library</li>
      </ul>
      <h2 className="pt-2 text-lg font-semibold text-white">Data credits</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Lunar DTMs: Barker et al., LRO LOLA; analysis-ready data by USGS Astrogeology (CC0, doi:10.5066/P13YV93V).</li>
        <li>Martian DTMs: MRO CTX stereo DTMs by USGS Astrogeology (CC0).</li>
        <li>Earth DEM: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.</li>
        <li>Basemap: © OpenStreetMap contributors.</li>
      </ul>
      <h2 className="pt-2 text-lg font-semibold text-white">Contributors</h2>
      <p>Contributor names have not been provided yet. Add the team here before submission.</p>
      <p className="text-xs text-slate-500">Not affiliated with or endorsed by NASA, ESA or USGS.</p>
    </div>
  );
}
