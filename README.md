---
title: Terrestrial Analog Finder
emoji: 🌔
colorFrom: indigo
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
short_description: Rank Earth locations by measured terrain similarity to the Moon and Mars
---

<!-- The block above configures the Hugging Face Space (see docs/DEPLOYMENT.md).
     GitHub renders it as a small metadata table; it is not part of the docs. -->

# Terrestrial Analog Finder

Rank places on Earth whose **measured terrain** resembles lunar south-polar sites (the regions discussed for a sustained
Moon presence) and well-studied regions of Mars, and show exactly why each place ranks where it does.

Built for the NASA Space Apps Challenge 2026. This is an independent project. It is not affiliated with or endorsed by NASA, ESA or USGS.

> **What a result means.** A high similarity index means the 12 km × 12 km window has similar relief, slope distribution,
> roughness and hypsometry to the planetary reference window at a 30 m grid. It is **not** a probability. It does not mean the
> place is physically identical to the Moon or Mars, and it does not identify landing sites, safe habitats or operationally suitable locations.

---

## 1. Project overview

The app has three parts:

- An **offline data pipeline** reads elevation windows from three public, cloud-optimised DEM archives. It reprojects every window
  to the same local 30 m grid, validates coverage and extracts datum-independent terrain features.
- A **FastAPI backend** serves locations, dataset provenance and methodology, and runs a transparent, deterministic similarity ranking.
- A **React explorer** provides Moon/Mars selection, reference-region selection, feature weights, an interactive map, ranked results,
  per-candidate explanations, distribution charts, a comparison view and a data/methodology page.

## 2. Challenge objective

Working assumption: the challenge is titled *"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*.
The official challenge page (spaceappschallenge.org) **could not be read from the build environment**. The egress policy blocked it,
and the site's robots.txt blocked the fetch tool. A secondary news source describes the challenge as finding places on Earth that
resemble the surface of the Moon or Mars (it names the Atacama Desert, Haughton Crater and Death Valley as examples) and gives
the event dates as 14–15 November 2026. Official datasets, rules and deliverables are therefore **unverified**. See
[docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md#submission-checklist).

## 3. Implemented features (verified)

- Moon/Mars mode with **12 planetary reference regions**: 8 LOLA south-polar sites (Connecting ridge, Shackleton rim, Peak near
  Shackleton, de Gerlache rim, Leibnitz beta plateau, Malapert massif, Nobile rim 1, Haworth) and 4 CTX DTM windows (Jezero,
  Gale, Meridiani, southern Utopia).
- An Earth candidate pool of **558 windows**: 20 named analog sites and 538 cells on a regular grid across 12 desert, polar and volcanic
  regions. 469 have complete data. 89 are explicitly excluded because of ocean, lakes or missing tiles, and are listed with the reason.
- Five scalar terrain features plus one distribution feature, all from real DEM measurements.
- A **thermal and mineral layer** measured from NASA Earthdata and PDS products: ECOSTRESS day/night land-surface temperature and
  VIIRS albedo reduced to an apparent-thermal-inertia estimate per Earth window, EMIT mineral classes per Earth window, MGS TES
  nightside thermal inertia per Mars window, and LRO Diviner modelled polar temperatures and ice-stability depth per Moon window.
  One comparable feature comes out of it (thermal-inertia percentile within each body); it carries a default weight of 0, so the
  terrain-only ranking stays exactly reproducible, and everything else is shown per candidate but never scored. Coverage is
  partial by nature and is reported, never filled in (see [docs/METHODOLOGY.md](docs/METHODOLOGY.md) §9).
- Weighted, robust-scaled distance with explicit missing-data rules, configurable weights and coverage threshold, and a
  per-feature contribution breakdown.
- Leaflet map with similarity-coloured markers, legend, selection, filters and a basemap-failure fallback (graticule plus notice).
- Candidate details: coordinates and coordinate provenance, side-by-side hillshades, per-feature table, contribution chart,
  slope-distribution and relative-elevation charts, source links, processing provenance and limitations.
- Comparison view for the reference region and up to three candidates.
- Data and methodology page served live from the API, including the sensitivity analysis.
- Loading, empty and error states throughout. The UI stays usable when the API is down or a search fails.

## 4. Architecture

```
data/sources/*.json ──► backend/pipeline (offline)         ──► data/processed/ (locations.json, hillshade/*.png,
  targets, named sites,   sources.py  acquisition +              manifest.json, sensitivity.json)
  survey grid, catalog    build.py    validation, features              │
                          sensitivity.py                                ▼
                                                     backend/app (FastAPI) ── /api/* ──► frontend (React/Vite)
                                                       features.py  registry.py           Explorer · Compare
                                                       similarity.py store.py main.py     Methodology · About
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 5. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Pipeline | Python 3.12, rasterio/GDAL 3.12, pyproj, NumPy, Pillow | COG range reads, reprojection between IAU planetary CRSs and Earth CRSs |
| API | FastAPI, Pydantic, NumPy | Typed request validation; the runtime needs no GDAL |
| Frontend | React 18, TypeScript, Vite 5, Tailwind 3, Leaflet 1.9 / react-leaflet 4, Recharts 2 | Default stack from the brief; nothing simpler would cover the map and charts |
| Tests | pytest, Vitest + Testing Library | |
| Storage | JSON + PNG files | 570 records do not justify a database (no PostGIS) |

## 6. Data sources (actually integrated)

| Body | Dataset | Access | Licence |
|---|---|---|---|
| Moon | Barker et al. LOLA south-polar DTMs, 5 m posting, USGS Astrogeology analysis-ready data ([doi:10.5066/P13YV93V](https://doi.org/10.5066/P13YV93V)) | Public COGs + STAC on `astrogeo-ard` S3 | CC0-1.0 |
| Mars | MRO CTX controlled stereo DTMs, ~20 m, USGS Astrogeology analysis-ready data | Public COGs + STAC on `astrogeo-ard` S3 | CC0-1.0 |
| Earth | Copernicus DEM GLO-30 (ESA), with each tile's Water Body Mask | Public COGs on `copernicus-dem-30m` S3 | Copernicus DEM licence (attribution) |

| Earth | ECOSTRESS `ECO_L2T_LSTE` v002 land-surface temperature, 70 m | CMR search + LP DAAC range reads (Earthdata Login) | Open NASA data |
| Earth | VIIRS `VNP43MA3` v002 white-sky shortwave albedo, 1 km | CMR search + LP DAAC download (Earthdata Login) | Open NASA data |
| Earth | EMIT `EMITL2BMIN` v002 mineral identification, 60 m | CMR search + LP DAAC download (Earthdata Login) | Open NASA data |
| Mars | MGS TES derived nightside thermal inertia, 20 pix/deg (`MGS-M-TES-5-TIMAP-V1.0`) | PDS Geosciences Node, direct download | Public domain |
| Moon | LRO Diviner Polar Resource Product, south (`LRO-L-DLRE-5-PRP-V2.0`) | PDS Geosciences Node, direct download | Public domain |

Investigated and **not integrated**: AppEEARS, MODIS `MCD43A3` albedo (HDF4, no driver here), Mars mineral maps (no archived
global mineral-class product reachable), lunar thermal inertia (no such product in the reachable archives), THEMIS IR mosaics
(rendered images, not temperatures) and Moon/Mars Trek (visualisation portals, no verified data API). Details, units, CRSs,
authentication and limitations for all of these are in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## 7. Scientific methodology (summary)

Each location is a **12 km × 12 km window** on a **local azimuthal-equidistant 30 m grid** using the body's own figure (WGS84,
lunar sphere R = 1 737 400 m, Mars sphere R = 3 396 190 m). Finer sources are aggregated with `average` resampling. Copernicus DEM
(about 30 m) uses `bilinear`. Windows with fewer than 95 % valid cells are not scored.

Features use **height differences only**, so different vertical datums never enter the comparison:

| Feature | Definition |
|---|---|
| Local relief (m, log₁₀) | P98 − P2 of elevation |
| Median / P90 slope (°) | Horn 3×3 slope on the 30 m grid |
| Short-baseline roughness (m, log₁₀) | RMS of elevation minus its 5×5 (150 m) moving mean |
| Hypsometric integral | (mean − P2)/(P98 − P2); missing if relief < 5 m |
| Slope distribution | Wasserstein-1 distance between 1° slope histograms |

Full definitions are in [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## 8. Similarity-score interpretation

```
d_i = (T_i(candidate) − T_i(reference)) / IQR_i     IQR over the fixed Earth reference pool (469 windows)
D   = sqrt( (Σ_available w_i d_i² + Σ_missing w_i P²) / Σ w_i )      P = missing penalty, default 3
S   = 100 · exp(−D)
```

S = 100 means identical values for the selected features. S ≈ 37 means the features differ by about one inter-quartile range
on average. S can only be compared within the same target, features, weights and data build. **It is not a probability.**

## 9. Installation

Requirements: Python 3.12 (3.11+ should work), Node 22 (or 18+) with npm, and internet access to PyPI and npm. The data pipeline
also needs HTTPS access to `*.s3.amazonaws.com`.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt     # runtime + pipeline + test deps
cd frontend && npm ci && cd ..
```

(`make setup` does the same.) The processed dataset is included in `data/processed`, so the app runs without downloading any DEMs.

## 10. Environment configuration

No credentials are needed. Optional overrides are listed in [.env.example](.env.example): `TAF_DATA_DIR`, `TAF_CORS_ORIGINS`,
`VITE_API_BASE`, `VITE_PROXY_TARGET`, `VITE_TILE_URL` and `VITE_TILE_ATTRIBUTION`.

## 11. Local execution

```bash
# terminal 1 – API on http://127.0.0.1:8000  (docs at /docs)
cd backend && ../.venv/bin/uvicorn app.main:app --port 8000
# terminal 2 – UI on http://127.0.0.1:5173
cd frontend && npm run dev
```

**Windows (PowerShell)**, from the project folder:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\pip install -r backend\requirements-dev.txt
cd frontend; npm ci; npm run build; cd ..
cd backend; ..\.venv\Scripts\uvicorn app.main:app --port 8000
# open http://127.0.0.1:8000/   (tests: ..\.venv\Scripts\python -m pytest -q)
```

These Windows steps have not been run on Windows yet. rasterio and pyproj are only needed for the pipeline and tests. To just run
the app, `backend\requirements.txt` is enough.

Single-process demo: run `cd frontend && npm run build`, then start the API. It serves `frontend/dist` at http://127.0.0.1:8000/.

Docker: `docker compose up --build` builds the frontend and serves everything on port 8000. *The Dockerfile has not been run
yet (no Docker daemon was available in the build environment). Verify it before relying on it.*

Rebuilding the data from the public sources:

```bash
cd backend
../.venv/bin/python -m pipeline.build          # ~570 windows; cached under data/cache/windows (~250 MB)
../.venv/bin/python -m pipeline.sensitivity    # needs the cache from the previous step
../.venv/bin/python -m pipeline.build_env      # thermal + mineral layer; needs EARTHDATA_TOKEN
```

Use `--refresh` to re-download, or `--only targets,named,survey` to rebuild part of the set.

`pipeline.build_env` is separate and resumable: each window is cached under `data/cache/env/<id>.json`, and `--limit N` measures
only the next N. It needs a free [NASA Earthdata Login](https://urs.earthdata.nasa.gov/) token in `EARTHDATA_TOKEN` (see
`.env.example`); the PDS products need none. It writes `data/processed/environment.json`, which the API merges onto the terrain
records, so running it changes no terrain value.

## 11b. Deployment

The image is self-contained — the processed dataset and every hillshade render are baked in, and there is no database
or secret to configure. `docker compose up --build` is the whole local deployment.

For a public URL, the project deploys to a free Hugging Face Space (Docker SDK); the YAML front matter at the top of
this file is that Space's configuration. Step-by-step instructions, verification checks and alternatives are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 12. Testing

```bash
cd backend && ../.venv/bin/python -m pytest -q       # 78 tests: features, engine, sources, environmental layer, API, data integrity
cd frontend && npm test && npm run typecheck && npm run lint && npm run build   # 25 tests + checks
```

Passing tests show the software computes what is documented. They do **not** show that the scientific comparison is valid.

## 13. Data attribution

- ECOSTRESS LST (`ECO_L2T_LSTE` v002), VIIRS albedo (`VNP43MA3` v002) and EMIT mineral identification (`EMITL2BMIN` v002): NASA JPL / NASA LP DAAC, retrieved through NASA Earthdata (CMR + LP DAAC distribution). Open NASA data; see the LP DAAC data-use guidance.
- MGS TES derived thermal inertia maps: Putzig, N. E. and Mellon, M. T., `MGS-M-TES-5-TIMAP-V1.0`, NASA Planetary Data System (Geosciences Node).
- LRO Diviner Polar Resource Products: Paige, D. A. et al., `LRO-L-DLRE-5-PRP-V2.0`, NASA Planetary Data System (Geosciences Node).
- Lunar DTMs: Barker, M. K., et al., *Lunar south polar digital terrain models from LOLA*, https://doi.org/10.5066/P13YV93V. LRO/LOLA (NASA). Analysis-ready data by USGS Astrogeology. CC0.
- Martian DTMs: USGS Astrogeology Science Center, MRO CTX controlled DTMs (Ames Stereo Pipeline), from NASA MRO CTX images. CC0.
- Copernicus DEM GLO-30: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
- Basemap tiles: © OpenStreetMap contributors (loaded in the user's browser).

## 14. Known limitations

These are summarised here. The full list is in [docs/SCIENTIFIC_LIMITATIONS.md](docs/SCIENTIFIC_LIMITATIONS.md).

- The comparison covers terrain geometry only, at a single scale (12 km windows, 30 m grid). The sensitivity analysis shows that
  window size changes the top-10 most (median overlap 4/10).
- Earth heights come from a *surface* model that includes vegetation and buildings. Short-baseline roughness is near the noise floor of the planetary DTMs.
- Named-site coordinates are **approximate and unverified**. The survey grid covers 12 regions, not the whole Earth.
- Thermal and mineral coverage is partial: ECOSTRESS reaches only about ±52° latitude, EMIT flies over selected arid regions, and
  no lunar thermal-inertia product exists in the reachable archives, so Moon targets cannot use the thermal feature at all.
- The cross-body thermal comparison is **ordinal**: Earth apparent thermal inertia (K⁻¹) and Mars TES thermal inertia (tiu) are
  different quantities, and only their within-body percentiles are compared. The two distributions are not calibrated against each
  other, and the Earth reference is this app's arid/volcanic/polar pool rather than Earth as a whole.
- Mineral identifications are per-pixel spectral-library matches grouped into classes by this project; they are displayed, never
  scored, because no equivalent planetary product was reachable.
- Illumination is still not represented.
- The Docker image and the OpenStreetMap basemap could not be checked from the build environment. The map fallback has been checked.

## 15. Future improvements

- Verify the official challenge requirements and named-site coordinates against a gazetteer such as Wikidata or GNIS.
- Add NASADEM via Earthdata Login as a NASA Earth DEM and compare it with Copernicus.
- Use multi-scale features (for example 3, 6 and 12 km windows) and report rank stability per candidate.
- Add more lunar and Martian targets from the same archives (all 27 Barker sites; HiRISE DTMs).
- Add a global coarse survey with GLO-90, followed by a 30 m refinement of the best cells.
- Investigate EMIT, CRISM and M3 mineralogy only where spectral products can be compared across bodies.

## 16. Contributors

**Team ghostblood** — NASA Space Apps Challenge 2026.

Individual member names are not recorded here yet; add them before submitting, and make sure every member is also
registered and listed on the team's Members tab on spaceappschallenge.org (Global Judging requires it).
