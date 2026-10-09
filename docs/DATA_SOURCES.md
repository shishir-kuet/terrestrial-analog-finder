# Data sources

All values below were read from the providers' own metadata (STAC items, CMR records, PDS labels and bucket READMEs) on 2026-10-09, unless marked otherwise. Records 1–3 are the terrain layer; records 4–8 are the thermal and mineral layer added on 2026-10-09 (see `METHODOLOGY.md` §9).
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

### 4. ECOSTRESS land-surface temperature, `ECO_L2T_LSTE` v002 (Earth)

| Item | Value |
|---|---|
| Identifier | `ECO_L2T_LSTE` version 002 (LP DAAC); granules selected per window through CMR, listed per location in `/api/locations/<id>/features` |
| Provider | NASA JPL / ECOSTRESS on the ISS; distributed by the NASA LP DAAC |
| Source URL | https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/ECO_L2T_LSTE.002/ (search: https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name=ECO_L2T_LSTE) |
| Variables | `_LST.tif` (land-surface temperature), `_cloud.tif`, `_water.tif` masks |
| Units | K |
| Resolution | 70 m, gridded on the Sentinel-2 MGRS tiling |
| Coverage | ~52° S to ~52° N (ISS orbit), acquired at drifting local times |
| Time | Scenes used are listed per location; the search is over the whole v002 archive |
| CRS | UTM per MGRS tile (e.g. EPSG:32611) |
| Licence | Open NASA data (LP DAAC data-use guidance); attribution requested |
| Authentication | **Earthdata Login required.** The distribution endpoint redirects to a signed CloudFront URL; in this build the egress proxy injects the token, and no credential is stored in the repository |
| Access | Verified by downloading a real granule, then read with GDAL range requests (`/vsicurl/`), so only the tiles covering the window transfer |
| Preprocessing | Scenes are kept only inside the local-solar-time windows 11:00–16:00 (day) and 22:00–05:00 (night), computed from the granule start time and the window longitude; cloud and water flags and temperatures outside 200–360 K are masked; a scene must cover ≥ 40 % of the window; 3–4 scenes per side are reduced to a per-pixel median; the day and night medians must cover ≥ 60 % of the window |
| Limitations | Skin temperature under an atmosphere, so not comparable with airless or thin-atmosphere surface temperature without a thermal model — which is why only the derived **apparent thermal inertia** is used, and only as a within-body rank. Overpass local times vary between scenes; cloud screening is imperfect; coverage is uneven and absent above ~52° latitude |

### 5. VIIRS/NPP BRDF albedo, `VNP43MA3` v002 (Earth)

| Item | Value |
|---|---|
| Identifier | `VNP43MA3` version 002, granules `VNP43MA3.A<YYYYDDD>.h<HH>v<VV>.002.*` |
| Provider | NASA / NOAA Suomi-NPP VIIRS; LP DAAC |
| Source URL | https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/VNP43MA3.002/ |
| Variable | `Albedo_WSA_shortwave` (white-sky shortwave albedo) with its mandatory quality flag |
| Units | Unitless (scale factor 0.001; fill 32767) |
| Resolution | 1 km, MODIS sinusoidal grid (1200 × 1200 per tile) |
| Coverage | Global land |
| Time | Two dates per window, 2022-01-01 and 2022-07-01, reduced to a median |
| CRS | MODIS sinusoidal (`+proj=sinu +R=6371007.181`) |
| Licence | Open NASA data (LP DAAC data-use guidance) |
| Authentication | Earthdata Login, as above |
| Access | HDF5 granules downloaded, the albedo band cached as a tile array, the granule deleted |
| Preprocessing | Only cells whose mandatory quality flag is 0 (full BRDF inversion) are kept; warped to the window grid; median of the two dates |
| Limitations | 1 km cells are much coarser than the 30 m window grid; two dates do not capture the seasonal cycle; snow cover at the two dates biases polar windows |

### 6. EMIT mineral identification, `EMITL2BMIN` v002 (Earth)

| Item | Value |
|---|---|
| Identifier | `EMITL2BMIN` version 002 (`EMIT_L2B_MIN_002_*`); granules used are listed per location |
| Provider | NASA JPL EMIT on the ISS; LP DAAC |
| Source URL | https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/EMITL2BMIN.002/ |
| Variables | `group_1_mineral_id`, `group_1_band_depth`, `group_2_mineral_id`, `group_2_band_depth`, `mineral_metadata/*`, `location/glt_x`, `location/glt_y` |
| Units | Mineral id (index into the product's spectral library); band depth unitless |
| Resolution | 60 m (ortho grid 0.000542°) |
| Coverage | Arid dust-source regions between about 52° S and 52° N; swaths, not a mosaic |
| Time | Per granule, listed per location |
| CRS | EPSG:4326 (geotransform in the granule's root attributes) |
| Licence | Open NASA data (LP DAAC data-use guidance) |
| Authentication | Earthdata Login, as above |
| Access | netCDF/HDF5 granule downloaded, orthorectified through the product's own GLT, then deleted |
| Preprocessing | Up to 3 granules are merged, newest first, each filling only cells no earlier granule covered; a window needs ≥ 50 % swath coverage; library names are grouped into mineral classes by the substring rules recorded in `/api/environment`; pixels with no identification are counted as a measured "no diagnostic absorption", not as missing data |
| Limitations | Identifications are per-pixel spectral-library matches of surface spectra, not bulk composition; the class grouping is this project's, not EMIT's; EMIT's two groups are reported separately because group 1 (iron-bearing) is hematite nearly everywhere; no equivalent planetary product was found in the archives reachable here, so these values are displayed but never scored |

### 7. MGS TES derived thermal inertia (Mars)

| Item | Value |
|---|---|
| Identifier | `MGS-M-TES-5-TIMAP-V1.0`, products `global_ti_night_2007.img` and `global_ti_msk_night_2007.img` |
| Provider | NASA MGS TES; maps derived by N. E. Putzig and M. T. Mellon; PDS Geosciences Node |
| Source URL | https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/ |
| Variable | Nightside derived thermal inertia, with the interpolation mask |
| Units | J m⁻² K⁻¹ s⁻¹ᐟ² ("tiu"), derived range 5–5000 |
| Resolution | 20 pixels/degree (2.96 km/pixel) |
| Coverage | Global, infilled between 87° S and 87° N (the archive states < 8 % infilled) |
| Time | TES observations February 1999 – April 2004 (orbits 1583–24346) |
| CRS | Simple cylindrical on a 3396.0 km sphere, planetocentric, east positive |
| Licence | Public domain (NASA PDS) |
| Authentication | None |
| Access | Direct HTTP download of the PDS3 image, read as a raw MSB int16 array per its detached label |
| Preprocessing | Values outside 5–5000 tiu dropped; warped to the 12 km Mars window; window median reported, plus the fraction of the window that the archive's mask marks as interpolated |
| Limitations | A 12 km window holds only ~16 source pixels, so these are regional values, not window-scale ones. Derived through a thermal model, not measured directly; nightside only; the sphere radius in this product's label (3396.0 km) differs slightly from the CTX DTM sphere (3396.19 km), a < 60 m offset that is irrelevant at 3 km sampling |

### 8. LRO Diviner Polar Resource Product (Moon)

| Item | Value |
|---|---|
| Identifier | `LRO-L-DLRE-5-PRP-V2.0`, product `DLRE_PRP_SOUTH.TAB` in bundle `urn-nasa-pds-lro_diviner_derived1` |
| Provider | NASA LRO Diviner Lunar Radiometer Experiment team (D. A. Paige, UCLA); PDS Geosciences Node |
| Source URL | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/ |
| Variables | `temp_avg` (annual average temperature at 2 cm depth), `temp_max` (annual maximum surface temperature), `ice_depth` (depth at which water ice would sublimate at 1 kg m⁻² Gyr⁻¹), with facet centre longitude/latitude |
| Units | K; m |
| Resolution | Triangular mesh, ~240 m facets (2 880 000 facets) |
| Coverage | 75.9° S to the south pole |
| Time | Product version 2, created 2018-02-21, from Diviner observations |
| CRS | Planetocentric latitude/longitude on a 1737.4 km sphere |
| Licence | Public domain (NASA PDS) |
| Authentication | None |
| Access | Direct HTTP download of the ASCII table (605 MB), parsed once and cached as an array |
| Preprocessing | Facets whose centre falls inside the 12 km window (in the window's own projection) are selected — the mesh is not resampled — and a window needs ≥ 50 facets; medians reported |
| Limitations | These are **modelled** temperatures constrained by Diviner, not direct measurements, and they are illumination-driven: they are not thermal inertia and are not comparable with the Earth or Mars thermal values, so they are displayed only. `ice_depth` = −999 means "deeper than 2.8738 m" per the label; the value −1, which occurs in 3.5 % of the table, is not documented there, so both are treated as not reported |

## Candidate coordinates

| Kind | Count | Coordinate provenance |
|---|---|---|
| Planetary targets | 12 | STAC `proj:centroid` of the source DTM (one shifted window, flagged) |
| Named Earth analog sites | 20 | **Approximate, supplied by the authors, unverified.** Gazetteers were unreachable. The terrain at each point is real DEM data, but the window may not be centred on the named feature. Spot checks: the hillshades show Meteor Crater centred in its window and the Askja caldera inside its window |
| Survey cells | 538 | Algorithmic: cell centres on a 1° or 2° grid inside the 12 boxes in `data/sources/survey_regions.json` |

## Investigated but not integrated

| Source | Outcome |
|---|---|
| NASA Earthdata Search / CMR | **Now used**: CMR granule search drives the ECOSTRESS, VIIRS and EMIT readers (records 4–6). The Earthdata Search web UI itself is not used |
| NASA AppEEARS | Not used. Granules are read directly from the LP DAAC distribution endpoint, so no task-based extraction service is needed. Its supported product list was **not** verified |
| ECOSTRESS raw temperature as a comparable feature | Not used as such. Earth skin temperature is not comparable with lunar or Martian surface temperature; only the derived apparent thermal inertia enters the comparison, and only as a within-body rank (record 4) |
| MODIS `MCD43A3` albedo | Not used: the granules are HDF-EOS2 (HDF4), and the GDAL build here has no HDF4 driver. `VNP43MA3` (HDF5) is used instead |
| Mars mineral maps (MRO CRISM, MGS TES mineral abundance) | **Searched and not integrated.** The CRISM collections reachable at PDS Geosciences are targeted/multispectral radiance and summary products requiring per-scene spectral processing, not a global mineral-class map; no archived global planetary mineral-group product was found in the hosts reachable here (`pds.nasa.gov`, `ode.rsl.wustl.edu`, `astrogeology.usgs.gov` and `planetarymaps.usgs.gov` are all refused by the egress policy). This is why EMIT mineral classes are Earth-side context and not a scored feature |
| Lunar thermal inertia | **Searched and not available.** The reachable LRO Diviner collections hold brightness temperatures, rock abundance (80° S–80° N, so not the polar targets) and the modelled polar products used in record 8 — no thermal inertia product. The thermal feature is therefore reported missing for every Moon target, with that reason |
| Moon Trek / Mars Trek | Blocked. These are visualisation portals, and no supported public data API was verified, so they are not used as data sources |
| PDS Geosciences (LOLA LDEM, MOLA MEGDR) | Reachable, but not needed for elevation: products from the same LOLA team are used through the USGS archive. The host is used for records 7 and 8 |
| THEMIS Mars IR mosaics (USGS archive) | Not used: the available mosaics are 8-bit rendered images, not calibrated temperatures |

The official Space Apps challenge page could not be read, so no "officially recommended dataset" list could be checked.
