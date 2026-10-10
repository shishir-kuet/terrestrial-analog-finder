"""Terrain feature extraction from a harmonised elevation window.

All functions here are pure NumPy so that they can be unit-tested with
hand-built grids and reused by the offline pipeline. Inputs are 2-D
elevation arrays in metres on a square metric grid (``res_m`` metres per
pixel) with ``NaN`` marking missing cells.

Every feature is *datum-independent*: none of them uses absolute elevation,
because Earth heights (Copernicus DEM, EGM2008 geoid), lunar heights
(sphere R = 1 737 400 m) and Martian heights (areoid / sphere) are referenced
to different surfaces and cannot be compared directly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

# Feature extraction parameters. The API reports them, with the resulting
# robust scales, at /api/methodology and /api/features.
MIN_VALID_FRACTION = 0.95  # window must have >= 95 % valid cells
RELIEF_LOW_Q = 2.0  # percentile used as robust minimum
RELIEF_HIGH_Q = 98.0  # percentile used as robust maximum
ROUGHNESS_KERNEL_PX = 5  # 5 x 5 moving-mean window (150 m at 30 m/px)
MIN_RELIEF_FOR_HI_M = 5.0  # hypsometric integral undefined below this relief
SLOPE_BIN_EDGES = np.arange(0.0, 91.0, 1.0)  # 1-degree bins, 0..90
ELEV_QUANTILES = np.arange(0, 101, 5)  # 0, 5, ..., 100 percent


@dataclass
class FeatureResult:
    """Scalar features, distributions and per-feature missing reasons."""

    values: dict[str, float | None]
    missing_reasons: dict[str, str] = field(default_factory=dict)
    slope_hist: list[float] | None = None  # area fraction per 1-degree bin
    rel_elev_quantiles: list[float] | None = None  # metres relative to median
    valid_fraction: float = 0.0


SCALAR_FEATURES = (
    "local_relief_m",
    "slope_median_deg",
    "slope_p90_deg",
    "roughness_rms_m",
    "hypsometric_integral",
)


def horn_slope_deg(z: np.ndarray, res_m: float) -> np.ndarray:
    """Slope in degrees using Horn's (1981) 3x3 finite-difference kernel.

    Cells whose 3x3 neighbourhood contains a NaN, and the outer border, are
    returned as NaN rather than being padded or extrapolated.
    """
    if res_m <= 0:
        raise ValueError("res_m must be positive")
    z = np.asarray(z, dtype=np.float64)
    out = np.full(z.shape, np.nan)
    if z.shape[0] < 3 or z.shape[1] < 3:
        return out
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8.0 * res_m)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8.0 * res_m)
    out[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    out[~np.isfinite(z)] = np.nan  # Horn ignores the centre cell; keep gaps as gaps
    return out


def moving_mean(z: np.ndarray, k: int) -> np.ndarray:
    """Mean over a k x k window, NaN where the window has any NaN or is
    clipped by the array edge (k must be odd)."""
    if k < 1 or k % 2 == 0:
        raise ValueError("kernel size must be a positive odd integer")
    z = np.asarray(z, dtype=np.float64)
    valid = np.isfinite(z)
    zz = np.where(valid, z, 0.0)
    r = k // 2
    out = np.full(z.shape, np.nan)
    if z.shape[0] < k or z.shape[1] < k:
        return out
    cs = np.pad(zz, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    cv = np.pad(valid.astype(np.int64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)

    def box(c):
        return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]

    s = box(cs)
    n = box(cv)
    m = np.where(n == k * k, s / (k * k), np.nan)
    out[r:-r or None, r:-r or None] = m
    return out


def roughness_rms(z: np.ndarray, k: int = ROUGHNESS_KERNEL_PX) -> float:
    """RMS of the residual between elevation and its k x k moving mean."""
    resid = np.asarray(z, dtype=np.float64) - moving_mean(z, k)
    resid = resid[np.isfinite(resid)]
    if resid.size == 0:
        return math.nan
    return float(np.sqrt(np.mean(resid**2)))


def slope_histogram(slope: np.ndarray) -> list[float]:
    s = slope[np.isfinite(slope)]
    if s.size == 0:
        return []
    counts, _ = np.histogram(np.clip(s, 0, 90), bins=SLOPE_BIN_EDGES)
    return (counts / s.size).round(6).tolist()


def extract_features(z: np.ndarray, res_m: float) -> FeatureResult:
    """Compute the documented terrain features for one elevation window."""
    z = np.asarray(z, dtype=np.float64)
    if z.ndim != 2:
        raise ValueError("elevation window must be 2-D")
    valid = np.isfinite(z)
    vf = float(valid.mean()) if z.size else 0.0
    values: dict[str, float | None] = {k: None for k in SCALAR_FEATURES}
    reasons: dict[str, str] = {}
    if vf < MIN_VALID_FRACTION:
        msg = (
            f"only {vf:.1%} of the window has valid elevation "
            f"(minimum {MIN_VALID_FRACTION:.0%})"
        )
        return FeatureResult(values, {k: msg for k in SCALAR_FEATURES}, None, None, vf)

    zv = z[valid]
    lo, hi = np.percentile(zv, [RELIEF_LOW_Q, RELIEF_HIGH_Q])
    relief = float(hi - lo)
    values["local_relief_m"] = relief

    slope = horn_slope_deg(z, res_m)
    sv = slope[np.isfinite(slope)]
    if sv.size:
        values["slope_median_deg"] = float(np.median(sv))
        values["slope_p90_deg"] = float(np.percentile(sv, 90))
    else:
        reasons["slope_median_deg"] = reasons["slope_p90_deg"] = "no valid 3x3 neighbourhoods"

    rough = roughness_rms(z)
    if math.isfinite(rough):
        values["roughness_rms_m"] = rough
    else:
        reasons["roughness_rms_m"] = "no complete 5x5 neighbourhoods"

    if relief >= MIN_RELIEF_FOR_HI_M:
        hi_val = (float(np.mean(np.clip(zv, lo, hi))) - lo) / relief
        values["hypsometric_integral"] = float(min(max(hi_val, 0.0), 1.0))
    else:
        reasons["hypsometric_integral"] = (
            f"undefined for near-flat terrain (relief {relief:.1f} m < {MIN_RELIEF_FOR_HI_M} m)"
        )

    med = float(np.median(zv))
    q = (np.percentile(zv, ELEV_QUANTILES) - med).round(2).tolist()
    return FeatureResult(values, reasons, slope_histogram(slope), q, vf)
