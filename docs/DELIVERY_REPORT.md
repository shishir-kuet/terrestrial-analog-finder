# Delivery report (MVP milestone, 2026-10-09)

## 1. Implemented and verified
- Moon/Mars selection with 12 reference regions: 8 LOLA south-polar sites and 4 CTX windows. Each region shows its hillshade, coordinates, dataset link and feature values.
- Earth pool of 558 windows: 20 named sites and 538 survey cells. 469 have complete data; the rest are explicitly excluded, with the reason given.
- Six terrain features from real DEMs on a common 30 m local grid. All are datum-independent.
- Transparent ranking: robust-scaled weighted RMS distance, similarity index S = 100·exp(−D), adjustable weights, coverage threshold, missing-data penalty and per-feature contributions.
- Leaflet map (markers coloured by similarity, legend, selection, type filter, unranked toggle, tile-failure fallback), ranked list, ranking chart, candidate details (hillshades, table, contribution chart, slope and elevation distributions, sources, limitations), Compare page, Data & methods page and About page.
- Loading, empty and error states, checked by component tests and by a headless-browser run where tiles were blocked.

## 2–3. Architecture and important files
See [ARCHITECTURE.md](ARCHITECTURE.md). Key files:
- `backend/pipeline/sources.py` – data acquisition and harmonisation
- `backend/pipeline/build.py` – feature build and provenance
- `backend/pipeline/sensitivity.py` – sensitivity analysis
- `backend/app/features.py` – feature extraction
- `backend/app/similarity.py` – ranking engine
- `backend/app/main.py` – HTTP API
- `frontend/src/pages/Explorer.tsx` – main explorer page
- `frontend/src/components/*` – map, charts and candidate details
- `data/processed/locations.json` – processed dataset

## 4–5. Datasets actually integrated
- Barker LOLA south-polar DTMs (USGS ARD, CC0, doi:10.5066/P13YV93V): https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/lro/lola/barker_south_pole_dems/
- MRO CTX controlled DTMs (USGS ARD, CC0): https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/
- Copernicus DEM GLO-30 and its Water Body Mask (ESA/Copernicus): https://copernicus-dem-30m.s3.amazonaws.com/readme.html

## 6–7. Features and formula
See [METHODOLOGY.md](METHODOLOGY.md): relief, median and P90 Horn slope, 150 m roughness, hypsometric integral, and slope-histogram W1.
D = sqrt((Σ_avail w d² + Σ_missing w P²)/Σw), S = 100·exp(−D). S is not a probability.

## 8–9. Checks executed (all passing on a fresh clone with Python 3.13 and Node 22)
- `pytest`: 46 passed (features, engine with hand-calculated cases, CRS and tile helpers, API, data integrity)
- `vitest`: 20 passed (formatting and coordinate validation, API client errors, charts empty state, Explorer loading/error/empty/search/missing-data flows)
- `tsc -b`, `eslint`, `vite build`: clean
- Headless Chromium run of the demo flow (Moon and Mars searches, compare view, 390 px mobile width with no horizontal scroll): no page errors
- Sensitivity analysis: see METHODOLOGY §6

## 10. Commands
See README §9–12 (`make setup`, `make api`, `make web`, `make test`, `make data`).

## 11. Environment variables
None are required. Optional ones are listed in `.env.example`.

## 12–13. Known limitations and incomplete items
- The official challenge page and rules were **not verified** (blocked from the build environment).
- Named Earth site coordinates are approximate and unverified.
- No environmental features (temperature, mineralogy, illumination) are integrated, because Earthdata-hosted sources were unreachable.
- The Dockerfile has **not been built or run**.
- The OSM basemap was not observable from the build environment (the fallback was verified).
- No deployment has been done.
- No ML component, by design (no labels; see METHODOLOGY §7).

## 14. Next steps before submission
1. Read the official challenge page and submission rules; update README §2 and the checklist in DEMO_GUIDE.md.
2. Add contributors.
3. Push to a public GitHub repository.
4. Build and run the Docker image, then deploy if required.
5. Verify named-site coordinates.
6. Record the demo following DEMO_GUIDE.md.
