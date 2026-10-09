# Methodology

## 1. Comparison unit

Every location, whether Moon, Mars or Earth, becomes the **same kind of object**:

- a 12 000 m × 12 000 m square (400 × 400 cells at 30 m);
- on a **local azimuthal-equidistant projection** centred on the location and using that body's figure (WGS84 ellipsoid, lunar
  sphere 1 737 400 m, Mars sphere 3 396 190 m). Distances from the centre are therefore true. Scale distortion at the window edge is
  below 0.01 %;
- resampled from the source with GDAL `average` when the source is finer than 0.75 × 30 m (LOLA 5 m, CTX ~20 m), and with `bilinear`
  when it is comparable (Copernicus ~30 m). Resampling never claims more detail than the source has; the common grid is set by
  the coarsest input;
- with missing cells left as missing. A window with fewer than 95 % valid cells gets no features and is reported as `insufficient_data`.

**Why 30 m and 12 km?** 30 m is the native spacing of the Earth DEM and coarser than both planetary products. 12 km fits inside the
16 km lunar DTM tiles and the CTX strips. The sensitivity analysis below quantifies how much this choice matters.

## 2. Features

All features are computed on the harmonised window by `backend/app/features.py`. None of them uses absolute elevation:
lunar, Martian and Earth heights refer to different datums (sphere, aeroid and geoid respectively).

| Key | Definition | Units | Transform | Default weight |
|---|---|---|---|---|
| `local_relief_m` | P98 − P2 of valid elevations | m | log₁₀(x + 1) | 1 |
| `slope_median_deg` | median of Horn (1981) 3×3 slope; cells with any missing neighbour are excluded | ° | none | 1 |
| `slope_p90_deg` | 90th percentile of the same slopes | ° | none | 1 |
| `roughness_rms_m` | RMS of (z − 5×5 moving mean), i.e. relief below about 150 m | m | log₁₀(x + 0.1) | 1 |
| `hypsometric_integral` | (mean(clip(z, P2, P98)) − P2) / (P98 − P2); **missing** when relief < 5 m | – | none | 0.5 |
| `slope_distribution` | Wasserstein-1 distance between 1° slope histograms (0–90°) | ° | none | 1 |

The slope baseline is 60 m (Horn uses ±1 cell). Slope is scale-dependent, so values are not comparable with slopes computed from
the 5 m LOLA posting or from 463 m MOLA grids.

Two distributions are stored for display: the slope histogram, and 21 quantiles of elevation relative to the window median.

## 3. Normalisation

For each feature, the difference between candidate and reference is divided by that feature's **inter-quartile range across the
Earth reference pool**. The pool is every Earth window with complete data (469 in the current build). The pool is fixed and does
not depend on the request, so a candidate's score never depends on which other candidates are displayed. Log transforms are
applied first to relief and roughness. These are positive scale quantities spanning about three orders of magnitude; without the
transform, a few high-relief windows would dominate the IQR. The distribution feature is scaled by the IQR of median slope, so its units (degrees) match.

Current scales (`/api/features`): relief 0.916 (log₁₀ m), median slope 3.63°, P90 slope 15.26°, roughness 0.595 (log₁₀ m),
hypsometric integral 0.152, slope distribution 3.63°.

## 4. Distance, similarity index and ranking

```
d_i = (T_i(x_cand) − T_i(x_ref)) / s_i                (scalar)
d_i =  W1(hist_cand, hist_ref) / s_i                  (distribution)
D   = sqrt( (Σ_{i available} w_i d_i² + Σ_{i missing} w_i P²) / Σ_i w_i )
S   = 100 · exp(−D)
coverage = Σ_{i available} w_i / Σ_i w_i
```

- Weights must be finite and ≥ 0, and at least one must be > 0. Unknown features are rejected (HTTP 422). Multiplying all weights by
  the same constant leaves D unchanged (tested).
- Ranking is by ascending D. Ties are broken by id, which makes it deterministic.
- `contribution_i = w_i d_i² / Σw` is reported for every feature. Its share of D² explains the rank.
- **S is a monotone re-expression of D, not a probability.** S = 100 means identical values for the selected features. S = 36.8 means
  an RMS difference of one IQR. S = 13.5 means two IQRs.

## 5. Missing-data policy

1. Missing values are stored as `null` with a reason. They are never zero-filled.
2. A missing **candidate** feature contributes a mismatch of P IQRs (default 3, adjustable from 0 to 10). Coverage is reported.
3. By default only candidates with **100 % coverage** are ranked. Users can relax this to 80 % or 60 %. Unranked candidates are
   listed with the reason and can be shown on the map.
4. A missing **reference** feature is dropped from the request with a visible warning, so all candidates are treated the same.
5. Windows with < 95 % valid cells (ocean, lakes or unreleased tiles on Earth; strip edges on Mars) are excluded entirely.

Fewer measured features therefore cannot earn a better score than a complete candidate that differs by less than P on each
missing feature (tested).

## 6. Sensitivity analysis (`python -m pipeline.sensitivity`)

Each perturbation is compared with the default ranking for all 12 targets over the full Earth pool:

| Perturbation | Median Spearman ρ | Min ρ | Median top-10 overlap | Min overlap |
|---|---|---|---|---|
| Weights × U[0.5, 1.5] (20 draws) | 0.998 | 0.993 | 9 | 7.5 |
| Drop local relief | 0.989 | 0.939 | 9 | 4 |
| Drop median slope | 0.995 | 0.981 | 8 | 5 |
| Drop P90 slope | 0.999 | 0.996 | 9 | 6 |
| Drop roughness | 0.999 | 0.956 | 9 | 7 |
| Drop hypsometric integral | 0.986 | 0.799 | 7 | 1 |
| Drop slope distribution | 0.989 | 0.981 | 8 | 6 |
| Coarser grid (90 m) | 0.983 | 0.957 | 6 | 4 |
| Smaller window (6 km) | 0.912 | 0.843 | 4 | 0 |

How to read this: the overall ordering is robust to weights and to dropping any one feature. **The exact top-10 depends on the
window size, and to a lesser degree on grid resolution and on the hypsometric integral.** Top candidates should be read as "similar at
the 12 km / 30 m scale". Under the 90 m perturbation, Meridiani loses its full-coverage window (94.8 % valid), so that row uses 11 targets.

## 7. Machine learning

No ML model is used. There are no labelled "good analog" pairs to train or evaluate against, and inventing labels is out of scope.
The transparent baseline is kept. Unsupervised exploration (clustering or PCA of the Earth pool) is a possible next step and
would be descriptive only.
