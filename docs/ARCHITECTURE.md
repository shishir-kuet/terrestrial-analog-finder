# Architecture

```
                    ┌────────────────────────── offline (python -m pipeline.build) ──────────────────────────┐
 data/sources/      │  sources.py            build.py                                  app/features.py      │
  targets.json  ───►│  acquisition:          orchestration: load site definitions,     pure-NumPy feature   │
  earth_named_      │  COG range reads,      fetch STAC metadata, read windows,        extraction (slope,   │
   sites.json       │  water-body masking,   validate coverage, shift incomplete       relief, roughness,   │
  survey_regions.   │  reprojection to a     target windows, extract features,         hypsometry,          │
   json             │  local 30 m AEQD grid  render hillshades, record provenance      histograms)          │
  datasets.json     └──────────────┬──────────────────────────────────────────────────────────────────────┘
  copernicus tile                  ▼
   list             data/cache/windows/*.npz (raw 400×400 windows, not committed)
                    data/processed/locations.json · manifest.json · hillshade/*.png · sensitivity.json
                                   │
                                   ▼
                    backend/app (FastAPI, uvicorn)
                      store.py       read-only loader; fixed Earth reference pool and robust scales
                      registry.py    feature definitions (meaning, method, transform, default weight)
                      similarity.py  weight validation, transforms, distances, ranking, missing-data policy
                      main.py        HTTP API + serving the built frontend
                                   │  JSON over /api
                                   ▼
                    frontend (React + TypeScript + Vite)
                      lib/api.ts          typed client with error normalisation
                      pages/Explorer      body/target selection, weights, map, ranked list, details
                      pages/Compare       reference vs up to 3 candidates
                      pages/Methodology   datasets, formula, features, sensitivity, limitations
                      components/         AnalogMap (Leaflet), Charts (Recharts), CandidateDetail
```

## Separation of concerns

| Concern | Where | Notes |
|---|---|---|
| Source data | public S3 COGs, never stored | Only the windows are cached, under `data/cache` |
| Source measurements | `data/cache/windows/*.npz` | Elevation in metres on the harmonised grid |
| Derived features | `data/processed/locations.json` (`features`, `slope_hist`, `rel_elev_quantiles`) | Rebuilt by the pipeline |
| Candidate metadata | `data/sources/*.json` and per-record `coordinate_status` / `coordinate_source` | |
| Provenance | per-record `processing.source_urls`, `source_item` (STAC); catalog in `data/sources/datasets.json` | |
| Similarity results | computed per request; never stored | Deterministic for a given data build |

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, number of locations and build time (503 if data is missing) |
| GET | `/api/datasets` | Integrated datasets and investigated-but-not-integrated sources |
| GET | `/api/features` | Feature registry and robust scales |
| GET | `/api/targets?body=moon\|mars` | Planetary reference regions |
| GET | `/api/earth-candidates?kind=&region=&status=` | Earth candidate pool |
| GET | `/api/earth-candidates/{id}` | One Earth candidate (404 for targets) |
| GET | `/api/regions` | Survey region definitions |
| GET | `/api/locations/{id}` | Full record |
| GET | `/api/locations/{id}/features` | Features, distributions and missing reasons |
| GET | `/api/locations/{id}/sources` | Dataset, STAC item, coordinate provenance and processing |
| GET | `/api/hillshade/{id}.png` | Hillshade preview of the analysis window |
| POST | `/api/similarity/search` | Ranking (body: `target_id`, `weights`, `candidate_kinds`, `regions`, `min_coverage`, `missing_penalty`, `limit`) |
| GET | `/api/methodology` | Method description, build manifest and sensitivity results |

Interactive OpenAPI docs are served at `/docs` when the API is running. Validation failures return 422. Unknown ids return 404.
Missing processed data returns 503.

## Why no database or microservices

There are 570 records of about 3 KB each. The API loads them into memory at start-up and ranks all candidates in a few
milliseconds. A database would add setup cost for judges without any benefit.
