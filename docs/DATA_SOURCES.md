# Data sources

All values below were read from the providers' own metadata (STAC items and bucket READMEs) on 2026-10-09, unless marked otherwise.
The machine-readable version is `data/sources/datasets.json`, served at `/api/datasets`.

## Integrated

### 1. Barker LOLA south-polar DTMs (Moon)

| Item | Value |
|---|---|
| Identifier | STAC items `moon/lro/lola/barker_south_pole_dems/<site>/<site>.json` in the USGS `astrogeo-ard` archive. Used sites: Site01 (Connecting ridge), Site04 (Shackleton rim), Site07 (Peak near Shackleton), Site11 (de Gerlache rim), Site20 (Leibnitz beta plateau), Site23 (Malapert massif), Site06 (Nobile rim 1), Haworth |
| Provider | NASA LRO/LOLA data, DTMs by Barker et al., analysis-ready COGs by the USGS Astrogeology Science Center |
| Source URL | https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/lro/lola/barker_south_pole_dems/ |
| Citation | Barker, M. K., et al. (2026). Lunar south polar digital terrain models from LOLA. https://doi.org/10.5066/P13YV93V (STAC `sci:citation`) |
| Variable | Height (`dtm` asset) |
| Units | m above the IAU 2015 lunar sphere, R = 1 737 400 m |
| Resolution | 5 m/pixel posting (STAC `gsd`). The effective resolution is coarser and depends on LOLA track density |
| Coverage | 27 sites, each about 16–30 km square, near the south pole |
| Time | 2009-08-20 to 2021-09-30 (LOLA observations) |
| CRS | IAU_2015:30135, south polar stereographic |
| Licence | CC0-1.0 |
| Authentication | None |
| Access | HTTP range reads of COGs (rasterio/GDAL `/vsicurl/`) |
| Preprocessing | Window centre from STAC `proj:centroid`; reprojected to a 12 km AEQD window on the same sphere at 30 m, `average` resampling |
| Limitations | Posting overstates resolution; only polar sites exist in this product |

### 2. MRO CTX controlled DTMs (Mars)

| Item | Value |
|---|---|
| Identifiers | `J03_045994_1986_XN_18N282W__J03_046060_1986_XN_18N282W` (Jezero), `D03_028335_1754_XI_04S222W__D03_028269_1752_XI_04S222W` (Gale), `B05_011765_1780_XN_02S005W__B08_012820_1779_XN_02S005W` (Meridiani), `N14_067844_2054_XN_25N250W__N13_067580_2051_XN_25N249W` (southern Utopia) |
| Provider | NASA MRO Context Camera images; DTMs by the USGS Astrogeology Science Center with the Ames Stereo Pipeline |
| Source URL | https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/ (index: `collectionindices/mro_ctx_controlled_usgs_dtms.parquet`, 44 628 items) |
| Variable | Height (`dtm` asset) |
| Units | m. The STAC description says DTMs are aligned to MOLA and adjusted to the Mars aeroid |
| Resolution | ~20 m/pixel (STAC `gsd` 20.0–20.7) |
| CRS | Mars 2015 sphere (R = 3 396 190 m), equirectangular |
| Licence | CC0-1.0 |
| Authentication | None |
| Access | HTTP range reads of COGs |
| Selection | For each mission landing area, we chose the DTM that contains the approximate landing point and whose centroid is closest to it, among items that have a STAC JSON. The approximate landing coordinates were used **only** to choose the DTM. The analysis window is centred on the DTM's own STAC centroid. For Meridiani, the window was shifted 3 km south to reach full coverage (recorded in the data). |
| Limitations | Stereo matching noise and artefacts; narrow strip footprints |

### 3. Copernicus DEM GLO-30 Public (Earth)

| Item | Value |
|---|---|
| Identifier | `Copernicus_DSM_COG_10_<lat>_00_<lon>_00_DEM` tiles (COP-DEM_GLO-30-DGED source) |
| Provider | ESA / Copernicus Programme (TanDEM-X: DLR, Airbus); COGs on the AWS Registry of Open Data |
| Source URL | https://copernicus-dem-30m.s3.amazonaws.com/readme.html |
| Variable | Surface height (DSM); `AUXFILES/*_WBM.tif` water-body mask |
| Units | m. According to the Copernicus DEM product handbook these are EGM2008 geoid heights; this could not be checked from the build environment. Only height differences are used. |
| Resolution | 1″ in latitude (~30 m); longitude spacing 1×–10× wider above 50° latitude (bucket README) |
| Coverage | Global land except unreleased tiles; no tiles over ocean |
| Time | TanDEM-X acquisitions, 2011–2015 |
| CRS | EPSG:4326 |
| Licence | Copernicus DEM licence (free use with attribution; `INFO/eula_F.pdf` in each tile) |
| Authentication | None |
| Access | HTTP range reads; tile existence checked against `tileList.txt` (copy in `data/sources/`) |
| Preprocessing | Cells flagged ocean (1), lake (2) or river (3) in the WBM are set to missing. All overlapping tiles are warped to a 12 km AEQD window on WGS84 at 30 m (`bilinear`). The README suggests assuming zero height over ocean; we deliberately do **not** do this |
| Limitations | Surface model (trees and buildings included); edited water surfaces; not a NASA product |

## Candidate coordinates

| Kind | Count | Coordinate provenance |
|---|---|---|
| Planetary targets | 12 | STAC `proj:centroid` of the source DTM (one shifted window, flagged) |
| Named Earth analog sites | 20 | **Approximate, supplied by the authors, unverified.** Gazetteers were unreachable. The terrain at each point is real DEM data, but the window may not be centred on the named feature. Spot checks: the hillshades show Meteor Crater centred in its window and the Askja caldera inside its window |
| Survey cells | 538 | Algorithmic: cell centres on a 1° or 2° grid inside the 12 boxes in `data/sources/survey_regions.json` |

## Investigated but not integrated

| Source | Outcome |
|---|---|
| NASA Earthdata Search / CMR | Host blocked by the build environment's egress policy; most products also need Earthdata Login. Would provide NASADEM/SRTM/ASTER elevation and MODIS/VIIRS land surface temperature |
| NASA AppEEARS | Blocked; needs an Earthdata token. Supported products and operations were **not** verified |
| ECOSTRESS | Blocked. Even with access, Earth skin temperature (with an atmosphere, at ISS overpass times) is not directly comparable with lunar or Martian surface temperature without a physical model |
| EMIT | Blocked. Coverage is limited to arid dust-source regions; a cross-body comparison needs equivalent spectral products (CRISM, M3) |
| Moon Trek / Mars Trek | Blocked. These are visualisation portals, and no supported public data API was verified, so they are not used as data sources |
| PDS Geosciences (LOLA LDEM, MOLA MEGDR) | Blocked. Products from the same LOLA team are used through the USGS archive |

The official Space Apps challenge page could not be read, so no "officially recommended dataset" list could be checked.
