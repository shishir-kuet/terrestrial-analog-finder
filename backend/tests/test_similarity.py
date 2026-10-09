import math

import pytest

from app.similarity import (
    SimilarityError,
    rank,
    robust_scale,
    score_candidate,
    transform,
    validate_weights,
    wasserstein1_hist,
)

SCALES = {
    "local_relief_m": 0.5,
    "slope_median_deg": 2.0,
    "slope_p90_deg": 4.0,
    "roughness_rms_m": 0.25,
    "hypsometric_integral": 0.1,
    "slope_distribution": 2.0,
}


def loc(id_, relief=100.0, smed=5.0, sp90=12.0, rough=1.0, hi=0.5, hist=None, status="ok"):
    hist = hist if hist is not None else [0.0] * 90
    if sum(hist) == 0:
        hist = hist.copy()
        hist[int(smed)] = 1.0
    return {
        "id": id_, "status": status, "slope_hist": hist,
        "features": {"local_relief_m": relief, "slope_median_deg": smed, "slope_p90_deg": sp90,
                     "roughness_rms_m": rough, "hypsometric_integral": hi},
        "missing_reasons": {},
    }


def test_identical_vectors_have_zero_distance_and_index_100():
    t = loc("t")
    r = score_candidate(t, loc("c"), {k: 1.0 for k in SCALES}, SCALES, 3.0, 1.0)
    assert r.distance == 0.0
    assert r.similarity_index == 100.0
    assert r.coverage == 1.0


def test_hand_calculated_distance():
    # median slope differs by 4 deg (2 IQR), p90 by 2 deg (0.5 IQR); weights 1 and 3
    t, c = loc("t", smed=5, sp90=12), loc("c", smed=9, sp90=14)
    w = {"slope_median_deg": 1.0, "slope_p90_deg": 3.0}
    r = score_candidate(t, c, w, SCALES, 3.0, 1.0)
    expected = math.sqrt((1 * 2.0**2 + 3 * 0.5**2) / 4)  # = sqrt(4.75/4)
    assert r.distance == pytest.approx(expected)
    assert r.similarity_index == pytest.approx(100 * math.exp(-expected))
    contrib = {c.key: c.contribution for c in r.comparisons}
    assert contrib["slope_median_deg"] == pytest.approx(4.0 / 4)
    assert contrib["slope_p90_deg"] == pytest.approx(0.75 / 4)


def test_log_transform_for_relief():
    t, c = loc("t", relief=99.0), loc("c", relief=999.0)  # log10(100)=2, log10(1000)=3
    r = score_candidate(t, c, {"local_relief_m": 1.0}, SCALES, 3.0, 1.0)
    assert r.distance == pytest.approx(1.0 / 0.5)


def test_distance_is_nonnegative_and_symmetric_in_magnitude():
    a, b = loc("a", smed=3, rough=0.5), loc("b", smed=8, rough=2.0)
    w = {"slope_median_deg": 1, "roughness_rms_m": 2}
    d1 = score_candidate(a, b, w, SCALES, 3, 1).distance
    d2 = score_candidate(b, a, w, SCALES, 3, 1).distance
    assert d1 >= 0 and d1 == pytest.approx(d2)


def test_weight_validation():
    with pytest.raises(SimilarityError, match="non-negative"):
        validate_weights({"slope_median_deg": -1})
    with pytest.raises(SimilarityError, match="all feature weights are zero"):
        validate_weights({"slope_median_deg": 0, "slope_p90_deg": 0.0})
    with pytest.raises(SimilarityError, match="unknown"):
        validate_weights({"temperature": 1})
    with pytest.raises(SimilarityError, match="finite"):
        validate_weights({"slope_median_deg": float("nan")})
    with pytest.raises(SimilarityError):
        validate_weights({})
    assert validate_weights({"slope_median_deg": 2, "slope_p90_deg": 0}) == {"slope_median_deg": 2.0}


def test_weight_scaling_does_not_change_ranking_or_distance():
    t = loc("t")
    cands = [loc("a", smed=7, rough=1.5), loc("b", smed=5.5, rough=3), loc("c", smed=9, rough=1.1)]
    w1 = {"slope_median_deg": 1, "roughness_rms_m": 2}
    w2 = {k: v * 10 for k, v in w1.items()}
    r1, _, _ = rank(t, cands, w1, SCALES)
    r2, _, _ = rank(t, cands, w2, SCALES)
    assert [r.location["id"] for r in r1] == [r.location["id"] for r in r2]
    assert [r.distance for r in r1] == pytest.approx([r.distance for r in r2])


def test_ranking_responds_consistently_to_weight_changes():
    t = loc("t", smed=5, rough=1.0)
    slope_match = loc("slope_match", smed=5, rough=4.0)
    rough_match = loc("rough_match", smed=11, rough=1.0)
    by_slope, _, _ = rank(t, [slope_match, rough_match], {"slope_median_deg": 1}, SCALES)
    by_rough, _, _ = rank(t, [slope_match, rough_match], {"roughness_rms_m": 1}, SCALES)
    assert by_slope[0].location["id"] == "slope_match"
    assert by_rough[0].location["id"] == "rough_match"


def test_missing_candidate_feature_is_reported_and_not_a_match():
    t = loc("t")
    c = loc("c")
    c["features"]["hypsometric_integral"] = None
    c["missing_reasons"]["hypsometric_integral"] = "undefined for near-flat terrain"
    w = {"slope_median_deg": 1, "hypsometric_integral": 1}
    # strict default: not ranked at all
    ranked, excluded, _ = rank(t, [c], w, SCALES)
    assert ranked == [] and excluded[0].missing_features == ["hypsometric_integral"]
    assert "coverage" in excluded[0].exclusion_reason
    # relaxed coverage: ranked but penalised, never a perfect match
    ranked, _, _ = rank(t, [c], w, SCALES, missing_penalty=3.0, min_coverage=0.5)
    r = ranked[0]
    assert r.coverage == 0.5
    assert r.distance == pytest.approx(math.sqrt(9 / 2))
    assert r.similarity_index < 100
    comp = next(x for x in r.comparisons if x.key == "hypsometric_integral")
    assert comp.status == "missing_candidate" and "near-flat" in comp.note


def test_missing_data_gives_no_advantage_over_complete_close_match():
    t = loc("t")
    close = loc("close", hi=0.55)  # 0.5 IQR away on the one differing feature
    gap = loc("gap")
    gap["features"]["hypsometric_integral"] = None
    w = {"slope_median_deg": 1, "hypsometric_integral": 1}
    ranked, _, _ = rank(t, [close, gap], w, SCALES, min_coverage=0.5)
    assert ranked[0].location["id"] == "close"


def test_missing_target_feature_is_dropped_with_warning():
    t = loc("t")
    t["features"]["hypsometric_integral"] = None
    ranked, _, warnings = rank(t, [loc("c")], {"slope_median_deg": 1, "hypsometric_integral": 1}, SCALES)
    assert warnings and "hypsometric_integral" in warnings[0]
    assert [c.key for c in ranked[0].comparisons] == ["slope_median_deg"]
    with pytest.raises(SimilarityError):
        rank(t, [loc("c")], {"hypsometric_integral": 1}, SCALES)


def test_candidates_without_valid_window_are_excluded():
    bad = loc("bad", status="insufficient_data")
    ranked, excluded, _ = rank(loc("t"), [bad, loc("ok")], {"slope_median_deg": 1}, SCALES)
    assert [r.location["id"] for r in ranked] == ["ok"]
    assert excluded[0].location["id"] == "bad"


def test_ranking_is_deterministic_with_ties_broken_by_id():
    t = loc("t")
    cands = [loc("b", smed=6), loc("a", smed=4), loc("c", smed=5)]
    ids = [[r.location["id"] for r in rank(t, list(cs), {"slope_median_deg": 1}, SCALES)[0]]
           for cs in (cands, cands[::-1])]
    assert ids[0] == ids[1] == ["c", "a", "b"]


def test_wasserstein_hand_values():
    p = [0, 1, 0, 0]
    q = [0, 0, 0, 1]
    assert wasserstein1_hist(p, q) == pytest.approx(2.0)
    assert wasserstein1_hist(p, p) == 0.0
    assert wasserstein1_hist([0.5, 0.5], [1, 1]) == 0.0  # mass-normalised
    with pytest.raises(ValueError):
        wasserstein1_hist([1, 0], [1, 0, 0])


def test_distribution_feature_in_score():
    h1 = [0.0] * 90
    h1[5] = 1.0
    h2 = [0.0] * 90
    h2[9] = 1.0
    t, c = loc("t", hist=h1), loc("c", hist=h2)
    r = score_candidate(t, c, {"slope_distribution": 1.0}, SCALES, 3, 1)
    assert r.distance == pytest.approx(4.0 / 2.0)


def test_robust_scale_and_transform():
    assert robust_scale([1, 2, 3, 4, 5]) == pytest.approx(2.0)
    assert robust_scale([1, 1, 1, 1, 5]) > 0  # falls back to std
    with pytest.raises(SimilarityError):
        robust_scale([2, 2, 2])
    assert transform("local_relief_m", None) is None
    assert transform("local_relief_m", float("nan")) is None
    assert transform("local_relief_m", 9.0) == pytest.approx(1.0)


def test_invalid_engine_parameters():
    with pytest.raises(SimilarityError):
        rank(loc("t"), [loc("c")], {"slope_median_deg": 1}, SCALES, min_coverage=0)
    with pytest.raises(SimilarityError):
        rank(loc("t"), [loc("c")], {"slope_median_deg": 1}, SCALES, missing_penalty=-1)
