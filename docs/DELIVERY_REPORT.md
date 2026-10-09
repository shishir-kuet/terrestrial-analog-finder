# Delivery report (MVP milestone, 2026-10-09; thermal and mineral layer added the same day)

## 1. Implemented and verified
- Moon/Mars selection with 12 reference regions: 8 LOLA south-polar sites and 4 CTX windows. Each region shows its hillshade, coordinates, dataset link and feature values.
- Earth pool of 558 windows: 20 named sites and 538 survey cells. 469 have complete data; the rest are explicitly excluded, with the reason given.
- Six terrain features from real DEMs on a common 30 m local grid. All are datum-independent.
- Transparent ranking: robust-scaled weighted RMS distance, similarity index S = 100·exp(−D), adjustable weights, coverage threshold, missing-data penalty and per-feature contributions.
- Leaflet map (markers coloured by similarity, legend, selection, type filter, unranked toggle, tile-failure fallback), ranked list, ranking chart, candidate details (hillshades, table, contribution chart, slope and elevation distributions, sources, limitations), Compare page, Data & methods page and About page.
- Loading, empty and error states, checked by component tests and by a headless-browser run where tiles were blocked.

### Thermal and mineral layer (added 2026-10-09)
- Access to NASA LP DAAC verified by downloading real granules end to end (an ECOSTRESS LST tile and an EMIT L2B mineral granule),
  after which GDAL range reads of the distribution endpoint were made to work by pointing GDAL's CA variable at this
  environment's bundle.
- Measured per 12 km window: ECOSTRESS day and night land-surface temperature medians (3–4 cloud-screened scenes per side inside
  fixed local-solar-time windows), VIIRS white-sky shortwave albedo, the derived apparent thermal inertia, and EMIT mineral-class
  fractions for both EMIT mineral groups (Earth); MGS TES nightside thermal inertia in tiu with its interpolated-area fraction
  (Mars); LRO Diviner modelled annual average and maximum temperature, ice-stability depth and stable-area fraction (Moon).
- One cross-body comparable feature, `thermal_inertia_percentile` (within-body rank), with a **default weight of 0**; the default
  search still sends exactly the six terrain features, so the ranking in this report is unchanged.
- Separate resumable build (`python -m pipeline.build_env`) writing `data/processed/environment.json`, merged onto the terrain
  records at load time. Coverage is reported per feature by `/api/environment` and shown next to the feature's weight slider.
- The build has now been **run to completion over all 570 locations** (12 targets and 558 Earth windows); every record returned
  `status: "ok"`, and the measured coverage is: 247 of the 469 rankable Earth windows carry `thermal_inertia_percentile` and 338
  carry EMIT mineral classes; of the 12 targets, the 4 Mars windows carry the thermal feature and the 8 Moon windows report it
  missing with the stated reason. Four windows failed on truncated granule downloads during the first pass and were re-measured
  successfully; two Sahara windows have no thermal value because too few ECOSTRESS scenes fell inside the required local-solar-time
  windows, which is recorded as a missing reason rather than filled in.
- Searched and **not** found in the archives reachable here: a lunar thermal-inertia product, and any archived global planetary
  mineral-class map. Both gaps are recorded as explicit missing reasons rather than substituted, so Moon targets report the
  thermal feature missing and EMIT mineral classes are displayed but never scored.

## 2–3. Architecture and important files
See [ARCHITECTURE.md](ARCHITECTURE.md). Key files:
- `backend/pipeline/sources.py` – data acquisition and harmonisation
- `backend/pipeline/earthdata.py` – CMR search and LP DAAC access (Earthdata token)
- `backend/pipeline/environment.py` – thermal and mineral readers and reductions
- `backend/pipeline/build_env.py` – environmental build and within-body percentiles
- `backend/pipeline/build.py` – feature build and provenance
- `backend/pipeline/sensitivity.py` – sensitivity analysis
- `backend/app/features.py` – feature extraction
- `backend/app/similarity.py` – ranking engine
- `backend/app/main.py` – HTTP API
- `frontend/src/pages/Explorer.tsx` – main explorer page
- `frontend/src/components/*` – map, charts and candidate details
- `data/processed/locations.json` – processed terrain dataset
- `data/processed/environment.json` – thermal and mineral measurements, provenance and percentile references
- `frontend/src/components/Environment.tsx` – thermal and mineral panel

## 4–5. Datasets actually integrated
- Barker LOLA south-polar DTMs (USGS ARD, CC0, doi:10.5066/P13YV93V): https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/lro/lola/barker_south_pole_dems/
- MRO CTX controlled DTMs (USGS ARD, CC0): https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/
- Copernicus DEM GLO-30 and its Water Body Mask (ESA/Copernicus): https://copernicus-dem-30m.s3.amazonaws.com/readme.html
- ECOSTRESS `ECO_L2T_LSTE` v002, VIIRS `VNP43MA3` v002, EMIT `EMITL2BMIN` v002 (NASA LP DAAC, Earthdata Login)
- MGS TES derived nightside thermal inertia `MGS-M-TES-5-TIMAP-V1.0` (PDS Geosciences)
- LRO Diviner Polar Resource Product `LRO-L-DLRE-5-PRP-V2.0` (PDS Geosciences)

## 6–7. Features and formula
See [METHODOLOGY.md](METHODOLOGY.md): relief, median and P90 Horn slope, 150 m roughness, hypsometric integral, and slope-histogram W1.
D = sqrt((Σ_avail w d² + Σ_missing w P²)/Σw), S = 100·exp(−D). S is not a probability.

## 8–9. Checks executed (all passing on a fresh clone with Python 3.13 and Node 22)
- `pytest`: 78 passed (features, engine with hand-calculated cases, CRS and tile helpers, API, data integrity, and the
  environmental layer: solar-time rules, mineral classification, the ATI formula and its rejections, percentile interpolation,
  the merge into the store, and that a missing thermal measurement cannot flatter a candidate)
- `vitest`: 25 passed (formatting and coordinate validation, API client errors, charts empty state, Explorer
  loading/error/empty/search/missing-data flows, the thermal/mineral panel, and that the partially measured feature starts off
  and is not sent with a default search)
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
- Thermal and mineral coverage is partial: ECOSTRESS reaches only about ±52° latitude, EMIT flies over selected arid regions, and
  cloud screening removes scenes. Measured over the completed build, 247 of the 469 rankable Earth windows have the thermal
  feature and 338 have mineral classes; the live counts are in `/api/environment`. Weighting the thermal feature therefore ranks
  roughly half the pool and excludes the rest, which the Explorer states next to the slider.
- The cross-body thermal comparison is ordinal (within-body percentiles of two different quantities, uncalibrated against each
  other), the Earth percentile reference is this app's pool rather than Earth as a whole, and no lunar thermal inertia exists in
  the reachable archives, so Moon targets cannot use the feature.
- Illumination is still not represented, and mineralogy has no planetary counterpart here, so it is displayed but never scored.
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
