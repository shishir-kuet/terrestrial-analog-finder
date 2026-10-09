import math

import numpy as np
import pytest

from app import features as fx


def plane(n=40, res=30.0, slope_deg=10.0):
    x = np.arange(n) * res
    return np.tile(x * math.tan(math.radians(slope_deg)), (n, 1))


def test_horn_slope_of_inclined_plane_is_exact():
    s = fx.horn_slope_deg(plane(slope_deg=10.0), 30.0)
    inner = s[1:-1, 1:-1]
    assert np.allclose(inner, 10.0, atol=1e-9)
    assert np.isnan(s[0]).all() and np.isnan(s[:, -1]).all()  # borders not extrapolated


def test_horn_slope_flat_is_zero_and_nan_propagates():
    z = np.full((10, 10), 123.0)
    z[5, 5] = np.nan
    s = fx.horn_slope_deg(z, 30.0)
    assert np.nanmax(s) == 0.0
    assert np.isnan(s[4:7, 4:7]).all()  # every 3x3 touching the gap is NaN


def test_horn_slope_rejects_bad_resolution():
    with pytest.raises(ValueError):
        fx.horn_slope_deg(np.zeros((5, 5)), 0)


def test_moving_mean_matches_bruteforce():
    rng = np.random.default_rng(0)
    z = rng.normal(size=(12, 12))
    m = fx.moving_mean(z, 5)
    assert np.isclose(m[6, 6], z[4:9, 4:9].mean())
    assert np.isnan(m[0, 0]) and np.isnan(m[-1, -1])


def test_roughness_zero_for_plane_and_positive_for_noise():
    assert fx.roughness_rms(plane()) == pytest.approx(0.0, abs=1e-9)
    rng = np.random.default_rng(1)
    assert fx.roughness_rms(plane() + rng.normal(scale=2.0, size=(40, 40))) > 1.0


def test_extract_features_plane_hand_values():
    z = plane(n=50, slope_deg=20.5)
    fr = fx.extract_features(z, 30.0)
    assert fr.values["slope_median_deg"] == pytest.approx(20.5)
    assert fr.values["slope_p90_deg"] == pytest.approx(20.5)
    # relief = P98 - P2 of a linear ramp of 50 columns spaced 30 m
    ramp = np.arange(50) * 30 * math.tan(math.radians(20.5))
    lo, hi = np.percentile(ramp, [2, 98])
    assert fr.values["local_relief_m"] == pytest.approx(hi - lo)
    assert fr.values["hypsometric_integral"] == pytest.approx(0.5, abs=0.01)
    assert sum(fr.slope_hist) == pytest.approx(1.0)
    assert fr.slope_hist[20] == pytest.approx(1.0)  # all mass in the 20-21 degree bin


def test_features_are_datum_independent():
    z = plane(n=30, slope_deg=5.0)
    a = fx.extract_features(z, 30.0)
    b = fx.extract_features(z - 4000.0, 30.0)  # e.g. Mars-like negative heights
    for k, v in a.values.items():
        assert b.values[k] == pytest.approx(v, abs=1e-6)
    assert b.rel_elev_quantiles == pytest.approx(a.rel_elev_quantiles, abs=0.01)


def test_insufficient_valid_cells_reports_every_feature_missing():
    z = plane()
    z[:, :5] = np.nan  # 12.5 % missing
    fr = fx.extract_features(z, 30.0)
    assert all(v is None for v in fr.values.values())
    assert set(fr.missing_reasons) == set(fx.SCALAR_FEATURES)
    assert fr.valid_fraction == pytest.approx(0.875)


def test_hypsometric_integral_missing_for_flat_terrain():
    fr = fx.extract_features(np.full((20, 20), 50.0), 30.0)
    assert fr.values["hypsometric_integral"] is None
    assert "near-flat" in fr.missing_reasons["hypsometric_integral"]
    assert fr.values["local_relief_m"] == 0.0  # measured, genuinely zero


def test_extraction_is_deterministic():
    rng = np.random.default_rng(42)
    z = rng.normal(size=(60, 60)).cumsum(0).cumsum(1)
    assert fx.extract_features(z, 30.0) == fx.extract_features(z.copy(), 30.0)
