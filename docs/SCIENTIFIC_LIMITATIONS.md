# Scientific limitations

## What the tool does not claim

- **Not a probability.** The similarity index is 100·exp(−D) of a weighted, robust-scaled distance. S = 90 does not mean "90 % identical".
- **Not physical equivalence.** The default ranking compares terrain geometry. Gravity, atmosphere, regolith mechanics,
  composition, radiation, illumination, volatiles and age are outside the comparison. Thermophysical character enters only if the
  thermal-inertia percentile is given a weight, and then only as a rank within each body (METHODOLOGY §9).
- **Not site selection.** Nothing here identifies landing sites, safe habitats or operationally suitable locations, on any body.
- **Not NASA-endorsed.** This is an independent hackathon project.

## Data limitations

| Issue | Effect | Mitigation |
|---|---|---|
| Copernicus DEM is a surface model | Forest canopy, buildings and ice surfaces add relief and roughness on Earth | Most survey regions are arid or polar. Roughness is a separate feature that can be down-weighted |
| LOLA 5 m posting is interpolated between laser tracks | Fine-scale roughness is underestimated on the Moon | Aggregation to 30 m. Roughness is measured over a 150 m kernel, not at pixel scale |
| CTX stereo DTMs contain matching noise | Can inflate Martian roughness slightly | Same aggregation |
| Water bodies on Earth are flattened | Lakes would look perfectly smooth | Water-body mask cells set to missing. Windows with < 95 % valid cells are excluded (for example, Askja's caldera lake) |
| Different vertical datums | Absolute heights are not comparable | Only height differences are used. Absolute median elevation is shown for context but never compared |
| Planetary coverage | 8 lunar sites, all south-polar; 4 Martian windows | Architecture accepts any STAC DTM item; add entries to `data/sources/targets.json` |
| Earth coverage | 558 windows in 12 regions plus 20 named sites | The survey is coarse (1–2° spacing). Absence from the list does not mean a place is a poor analog |
| ECOSTRESS covers only about ±52° latitude, at drifting local times | No apparent thermal inertia for polar windows; day/night pairs come from different dates | Scenes are restricted to fixed local-solar-time windows and reduced to medians over 3–4 scenes; windows without a usable pair report the feature missing with that reason |
| VIIRS albedo is 1 km and sampled on two dates | Albedo is coarser than the window grid and misses the seasonal cycle | Only full-inversion (quality 0) cells are used; the two dates are reduced to a median; the limitation is stated with the feature |
| EMIT flies over selected arid regions in swaths | Mineral classes exist for a minority of windows | Up to 3 granules are merged per window, a window needs ≥ 50 % swath coverage, and mineral data never enters the score |
| MGS TES thermal inertia is ~3 km per pixel | A 12 km window holds only ~16 source pixels | Reported as a regional value with its interpolated-area fraction; the resolution mismatch is stated with the feature |
| No lunar thermal inertia product is reachable | Moon targets cannot use the thermal feature at all | The feature is reported missing for every Moon target with that reason, and dropped from such a request with a visible warning; Diviner modelled temperatures are shown as context instead |

## Method limitations

- **Scale dependence.** Shrinking the window from 12 km to 6 km changes the median top-10 by 6 of 10 candidates. Coarsening the
  grid to 90 m changes it by 4 (see METHODOLOGY §6).
- **Pool-dependent scaling.** IQRs come from the Earth reference pool. Adding regions changes the scales and therefore every index.
  Indices are comparable only within one data build.
- **Bag-of-values features.** Statistics ignore spatial arrangement. A crater and a scarp with the same slope distribution look alike.
- **Correlated features.** Median slope, P90 slope and the slope distribution are correlated, so the default weights already favour slope.
- **Hypsometric integral** depends on where the window boundary falls and is undefined on near-flat terrain.
- **Cross-body thermal comparison is ordinal.** Earth apparent thermal inertia (K⁻¹) and Mars TES thermal inertia (tiu) are
  different quantities; only their within-body percentiles are compared, and those two distributions are not calibrated against
  each other. The Earth reference is this app's arid/volcanic/polar pool, not Earth as a whole, while the Mars reference is the
  whole planet.
- **Apparent thermal inertia is a proxy, not thermal inertia.** It omits the thermal-model terms (insolation, sky conditions,
  overpass times, subsurface layering) that a true inversion would include.
- **Mineral identifications are spectral matches**, grouped into classes by this project's documented substring rules, and
  describe surface spectra rather than bulk composition. They are displayed, never scored.

## Coordinate limitations

- Named Earth sites use approximate coordinates that the authors could not verify against a gazetteer. Each one is flagged
  "approximate coordinates" in the UI.
- Mars targets were chosen by containing an approximate landing point. Their windows are centred on the DTM's own metadata
  centroid, so they represent the surrounding region, not the exact landing site.

## Verification status

| Item | Status |
|---|---|
| Unit and API tests | 46 backend and 20 frontend tests pass. This shows the software is correct, not that the science is valid |
| Official challenge text and rules | **Not verified** (site unreachable) |
| Docker image | **Not run** (no Docker daemon in the build environment) |
| OSM basemap in a browser | Not observable from the build environment. The fallback graticule was verified in a headless browser |
| External validation against expert analog lists | Not done |
