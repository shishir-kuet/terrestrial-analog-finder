"""Tests for the environmental (thermal and mineral) layer.

These cover the reductions and the merge into the API, not the network: the
readers are exercised against real granules by ``pipeline.build_env``, and what
is testable offline is the arithmetic, the classification rules and the
missing-data behaviour.
"""

import json
import math

import numpy as np
import pytest

from app.registry import ENVIRONMENTAL_FEATURES, FEATURES
from app.similarity import SimilarityError, compute_scales, rank
from app.store import Store
from pipeline import environment as env
from pipeline.build_env import percentile_of

THERMAL = "thermal_inertia_percentile"


# ------------------------------------------------------------ solar-time rules
@pytest.mark.parametrize(
    "iso,lon,expected",
    [
        ("2022-07-01T12:00:00Z", 0.0, 12.0),
        ("2022-07-01T12:00:00Z", -120.0, 4.0),  # 8 h behind UTC
        ("2022-07-01T00:30:00Z", 180.0, 12.5),  # wraps the day
    ],
)
def test_local_solar_hour(iso, lon, expected):
    assert env.local_solar_hour(iso, lon) == pytest.approx(expected)


def test_night_window_wraps_midnight():
    assert env.in_solar_window(23.5, env.NIGHT_SOLAR_HOURS)
    assert env.in_solar_window(2.0, env.NIGHT_SOLAR_HOURS)
    assert not env.in_solar_window(12.0, env.NIGHT_SOLAR_HOURS)
    assert env.in_solar_window(13.0, env.DAY_SOLAR_HOURS)
    assert not env.in_solar_window(6.0, env.DAY_SOLAR_HOURS)


# ------------------------------------------------------------ mineral classes
@pytest.mark.parametrize(
    "name,expected",
    [
        ("fe3+_hematite.nano.BR34b2b", "hematite"),
        ("fe3+_goethite.thincoat", "goethite"),
        ("kaolinite_kga-1_wxl", "kaolinite"),
        ("montmorillonite+illite", "smectite"),  # first matching rule wins
        ("muscovite_gds113", "illite_muscovite"),
        ("gypsum_sds10", "gypsum"),
        ("alunite+pyrophyl", "other_sulfate"),
        ("calcite_ws272", "calcite"),
        ("dolomite_hs102.3b", "dolomite"),
        ("carbonate_rhodochrosite", "other_carbonate"),
        ("fe2+generic_nrw.cummingtonite", "other_iron_bearing"),
        ("organic_green_plastic_tarp_1um", "other"),
    ],
)
def test_mineral_class_rules(name, expected):
    assert env.mineral_class(name) == expected


def test_every_class_is_declared():
    for name in {env.mineral_class(n) for n in ("hematite", "nothing-here")}:
        assert name in env.MINERAL_CLASSES


# ------------------------------------------------------ apparent thermal inertia
def test_apparent_thermal_inertia_is_the_documented_formula():
    day = np.array([[320.0, 300.0]], dtype="float32")
    night = np.array([[300.0, 290.0]], dtype="float32")
    albedo = np.array([[0.2, 0.4]], dtype="float32")
    ati = env.apparent_thermal_inertia(day, night, albedo)
    assert ati[0, 0] == pytest.approx((1 - 0.2) / 20.0)
    assert ati[0, 1] == pytest.approx((1 - 0.4) / 10.0)


def test_apparent_thermal_inertia_rejects_degenerate_or_inverted_pairs():
    day = np.array([[300.0, 300.0, 300.0]], dtype="float32")
    night = np.array([[299.5, 301.0, np.nan]], dtype="float32")
    albedo = np.array([[0.2, 0.2, 0.2]], dtype="float32")
    ati = env.apparent_thermal_inertia(day, night, albedo)
    assert not np.isfinite(ati).any()  # sub-kelvin, inverted and missing all rejected


def test_summarise_requires_enough_valid_area():
    values = np.full((10, 10), np.nan, dtype="float32")
    values[:5, :] = 1.0  # 50 % valid, below the 60 % threshold
    assert env.summarise(values) is None
    values[:7, :] = 1.0
    s = env.summarise(values)
    assert s is not None and s["median"] == 1.0 and s["valid_fraction"] == pytest.approx(0.7)


# ------------------------------------------------------------------ percentiles
def test_percentile_of_interpolates_between_quantiles():
    qs = [0.0, 50.0, 100.0]
    vals = [10.0, 20.0, 40.0]
    assert percentile_of(20.0, qs, vals) == pytest.approx(50.0)
    assert percentile_of(30.0, qs, vals) == pytest.approx(75.0)
    assert percentile_of(5.0, qs, vals) == pytest.approx(0.0)  # clamped, never extrapolated


# ------------------------------------------------------- registry and engine
def test_environmental_feature_is_registered_and_off_by_default():
    for key in ENVIRONMENTAL_FEATURES:
        assert key in FEATURES
        assert FEATURES[key].default_weight == 0.0, "enabling it by default would change the terrain ranking"


def test_unscalable_feature_is_dropped_with_a_warning_not_an_error():
    pool = [{"features": {"slope_median_deg": v, THERMAL: None}} for v in (1.0, 5.0, 9.0)]
    scales = compute_scales(pool)
    assert scales[THERMAL] is None
    target = {"features": {"slope_median_deg": 5.0, THERMAL: 50.0}, "missing_reasons": {}}
    cand = {"id": "c", "status": "ok", "features": {"slope_median_deg": 6.0, THERMAL: 60.0}, "missing_reasons": {}}
    ranked, _, warnings = rank(target, [cand], {"slope_median_deg": 1.0, THERMAL: 1.0}, scales)
    assert len(ranked) == 1
    assert any(THERMAL in w for w in warnings)
    assert [c.key for c in ranked[0].comparisons] == ["slope_median_deg"]


def test_engine_still_refuses_a_request_with_no_usable_feature():
    pool = [{"features": {"slope_median_deg": v, THERMAL: None}} for v in (1.0, 5.0, 9.0)]
    scales = compute_scales(pool)
    target = {"features": {"slope_median_deg": 5.0}, "missing_reasons": {}}
    with pytest.raises(SimilarityError):
        rank(target, [], {THERMAL: 1.0}, scales)


# ------------------------------------------------------------------ the merge
def _write_dataset(tmp_path, environment: dict | None):
    processed = tmp_path / "processed"
    processed.mkdir(parents=True)
    (tmp_path / "sources").mkdir()
    locations = [
        {"id": "t1", "kind": "target", "body": "mars", "name": "T", "lat": 0.0, "lon": 0.0, "status": "ok",
         "features": {"slope_median_deg": 5.0}, "missing_reasons": {}, "dataset_id": "d"},
        {"id": "e1", "kind": "earth_named", "body": "earth", "name": "E1", "lat": 10.0, "lon": 10.0, "status": "ok",
         "features": {"slope_median_deg": 6.0}, "missing_reasons": {}, "dataset_id": "d"},
        {"id": "e2", "kind": "earth_named", "body": "earth", "name": "E2", "lat": 11.0, "lon": 11.0, "status": "ok",
         "features": {"slope_median_deg": 7.0}, "missing_reasons": {}, "dataset_id": "d"},
    ]
    (processed / "locations.json").write_text(json.dumps({"locations": locations}))
    (processed / "manifest.json").write_text(json.dumps({"built_at": "now"}))
    if environment is not None:
        (processed / "environment.json").write_text(json.dumps(environment))
    return Store(tmp_path)


def test_merge_attaches_values_attributes_and_reasons(tmp_path):
    store = _write_dataset(tmp_path, {
        "built_at": "now",
        "locations": {
            "t1": {"values": {THERMAL: 88.0}, "missing_reasons": {}, "attributes": {"thermal_inertia_median_tiu": 313.3},
                   "provenance": {}, "status": "ok"},
            "e1": {"values": {}, "missing_reasons": {THERMAL: "no usable ECOSTRESS night scenes"},
                   "attributes": {}, "provenance": {}, "status": "ok"},
        },
    })
    assert store.locations["t1"]["features"][THERMAL] == 88.0
    assert store.locations["t1"]["environment"]["attributes"]["thermal_inertia_median_tiu"] == 313.3
    assert store.locations["e1"]["features"][THERMAL] is None
    assert "ECOSTRESS" in store.locations["e1"]["missing_reasons"][THERMAL]
    # e2 is absent from the environmental build entirely
    assert store.locations["e2"]["features"][THERMAL] is None
    assert "not covered" in store.locations["e2"]["missing_reasons"][THERMAL]
    assert store.locations["e2"]["environment"] is None


def test_terrain_features_and_scales_are_untouched_by_the_merge(tmp_path):
    without = _write_dataset(tmp_path / "a", None)
    with_env = _write_dataset(tmp_path / "b", {
        "built_at": "now",
        "locations": {"e1": {"values": {THERMAL: 10.0}, "missing_reasons": {}, "attributes": {}, "provenance": {}, "status": "ok"},
                      "e2": {"values": {THERMAL: 90.0}, "missing_reasons": {}, "attributes": {}, "provenance": {}, "status": "ok"}},
    })
    assert without.scales["slope_median_deg"] == with_env.scales["slope_median_deg"]
    assert without.locations["e1"]["features"]["slope_median_deg"] == with_env.locations["e1"]["features"]["slope_median_deg"]
    assert without.scales[THERMAL] is None  # not measured at all
    assert with_env.scales[THERMAL] == pytest.approx(40.0)  # IQR of [10, 90]


def test_missing_thermal_measurement_cannot_flatter_a_candidate(tmp_path):
    """A candidate with no thermal measurement must not outrank one that has it
    and matches: the missing value is a penalty, and coverage drops."""
    store = _write_dataset(tmp_path, {
        "built_at": "now",
        "locations": {
            "t1": {"values": {THERMAL: 50.0}, "missing_reasons": {}, "attributes": {}, "provenance": {}, "status": "ok"},
            "e1": {"values": {THERMAL: 50.0}, "missing_reasons": {}, "attributes": {}, "provenance": {}, "status": "ok"},
            "e2": {"values": {}, "missing_reasons": {THERMAL: "no coverage"}, "attributes": {}, "provenance": {}, "status": "ok"},
        },
    })
    # a third Earth window is needed so the feature has spread; reuse e1/e2 plus the target value
    scales = {"slope_median_deg": 1.0, THERMAL: 10.0}
    ranked, excluded, _ = rank(store.locations["t1"], [store.locations["e1"], store.locations["e2"]],
                               {THERMAL: 1.0}, scales, missing_penalty=3.0, min_coverage=1.0)
    assert [r.location["id"] for r in ranked] == ["e1"]
    assert [r.location["id"] for r in excluded] == ["e2"]
    assert excluded[0].distance == pytest.approx(3.0)
    assert math.isclose(ranked[0].distance, 0.0)
