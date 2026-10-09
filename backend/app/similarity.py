"""Transparent, deterministic similarity-ranking engine.

For a planetary target t and an Earth candidate c, each selected feature i
gives a scaled difference

    d_i = (T_i(x_c,i) - T_i(x_t,i)) / s_i            (scalar features)
    d_i = W1(slope_hist_c, slope_hist_t) / s_i       (distribution feature)

where T_i is the documented transform (identity or log10(x + offset)) and
s_i is the inter-quartile range of T_i over the fixed Earth reference pool
(robust scaling). With non-negative weights w_i the distance is a weighted
root-mean-square

    D = sqrt( (sum_avail w_i d_i^2 + sum_missing w_i P^2) / sum_all w_i )

where P is the missing-feature penalty (default 3 IQRs): a missing value is
counted as a large mismatch, never as a match. Coverage is
sum_avail w_i / sum_all w_i, and only candidates with coverage >= min_coverage
are ranked. The displayed similarity index is S = 100 * exp(-D); it is a
monotone re-expression of D, not a probability.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from app.registry import FEATURES, SCALE_SOURCE

DEFAULT_MISSING_PENALTY = 3.0


class SimilarityError(ValueError):
    """Invalid request (bad weights, unknown features, unusable target)."""


# ------------------------------------------------------------- primitives
def transform(key: str, value: float | None) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    f = FEATURES[key]
    if f.transform == "log10":
        v = value + f.log_offset
        return math.log10(v) if v > 0 else None
    return float(value)


def wasserstein1_hist(p: list[float], q: list[float], bin_width: float = 1.0) -> float:
    """W1 distance between two histograms on identical bins (each is
    normalised to unit mass first)."""
    a, b = np.asarray(p, float), np.asarray(q, float)
    if a.shape != b.shape or a.size == 0:
        raise ValueError("histograms must be non-empty and share bins")
    if a.sum() <= 0 or b.sum() <= 0 or (a < 0).any() or (b < 0).any():
        raise ValueError("histograms must be non-negative with positive mass")
    return float(np.abs(np.cumsum(a / a.sum()) - np.cumsum(b / b.sum())).sum() * bin_width)


def robust_scale(values: list[float]) -> float:
    """IQR of the values; falls back to the standard deviation when the IQR
    is zero. Raises if the feature has no spread at all."""
    v = np.asarray([x for x in values if x is not None and math.isfinite(x)], float)
    if v.size < 2:
        raise SimilarityError("not enough reference values to scale feature")
    q1, q3 = np.percentile(v, [25, 75])
    s = float(q3 - q1)
    if s <= 1e-12:
        s = float(v.std())
    if s <= 1e-12:
        raise SimilarityError("feature has no spread in the reference pool")
    return s


def compute_scales(pool: list[dict]) -> dict[str, float]:
    """Per-feature robust scales from the Earth reference pool."""
    scales = {}
    for key, f in FEATURES.items():
        src = SCALE_SOURCE.get(key, key)
        vals = [transform(src, r["features"].get(src)) for r in pool]
        scales[key] = robust_scale([v for v in vals if v is not None])
    return scales


def validate_weights(weights: dict[str, float]) -> dict[str, float]:
    if not weights:
        raise SimilarityError("at least one feature weight is required")
    unknown = sorted(set(weights) - set(FEATURES))
    if unknown:
        raise SimilarityError(f"unknown feature(s): {', '.join(unknown)}")
    clean = {}
    for k, w in weights.items():
        if w is None or not isinstance(w, (int, float)) or not math.isfinite(w):
            raise SimilarityError(f"weight for {k} must be a finite number")
        if w < 0:
            raise SimilarityError(f"weight for {k} must be non-negative")
        if w > 0:
            clean[k] = float(w)
    if not clean:
        raise SimilarityError("all feature weights are zero; select at least one feature")
    return clean


# ----------------------------------------------------------------- engine
@dataclass
class FeatureComparison:
    key: str
    weight: float
    normalized_weight: float
    target_value: float | None
    candidate_value: float | None
    scaled_difference: float | None  # signed for scalars, >= 0 for distributions
    contribution: float  # w_i * d_i^2 / sum_all w  (share of D^2 numerator)
    status: str  # "compared" | "missing_candidate"
    note: str | None = None


@dataclass
class CandidateResult:
    location: dict
    distance: float
    similarity_index: float
    coverage: float
    ranked: bool
    comparisons: list[FeatureComparison] = field(default_factory=list)
    missing_features: list[str] = field(default_factory=list)
    exclusion_reason: str | None = None


def feature_difference(key: str, target: dict, cand: dict, scales: dict[str, float]) -> tuple[float | None, float | None, float | None]:
    """Return (target_value, candidate_value, scaled difference); difference
    is None when the candidate lacks the measurement."""
    f = FEATURES[key]
    if f.kind == "distribution":
        th, ch = target.get("slope_hist"), cand.get("slope_hist")
        if not ch:
            return None, None, None
        w1 = wasserstein1_hist(ch, th)
        return 0.0, w1, w1 / scales[key]
    tv, cv = target["features"].get(key), cand["features"].get(key)
    tt, ct = transform(key, tv), transform(key, cv)
    if ct is None:
        return tv, cv, None
    return tv, cv, (ct - tt) / scales[key]


def target_usable(key: str, target: dict) -> bool:
    if FEATURES[key].kind == "distribution":
        return bool(target.get("slope_hist"))
    return transform(key, target["features"].get(key)) is not None


def score_candidate(target: dict, cand: dict, weights: dict[str, float], scales: dict[str, float],
                    missing_penalty: float, min_coverage: float) -> CandidateResult:
    total_w = sum(weights.values())
    num = 0.0
    avail_w = 0.0
    comps: list[FeatureComparison] = []
    missing: list[str] = []
    for key in sorted(weights):
        w = weights[key]
        tv, cv, d = feature_difference(key, target, cand, scales)
        if d is None:
            missing.append(key)
            contrib = w * missing_penalty**2 / total_w
            reason = cand.get("missing_reasons", {}).get(key) or "measurement unavailable"
            comps.append(FeatureComparison(key, w, w / total_w, tv, cv, None, contrib, "missing_candidate", reason))
        else:
            avail_w += w
            contrib = w * d * d / total_w
            comps.append(FeatureComparison(key, w, w / total_w, tv, cv, d, contrib, "compared"))
        num += contrib
    dist = math.sqrt(num)
    coverage = avail_w / total_w
    ranked = coverage >= min_coverage - 1e-12 and cand.get("status") == "ok"
    reason = None
    if cand.get("status") != "ok":
        reason = cand.get("error") or "insufficient valid elevation data in window"
    elif not ranked:
        reason = f"data coverage {coverage:.0%} below required {min_coverage:.0%}"
    return CandidateResult(cand, dist, 100.0 * math.exp(-dist), coverage, ranked, comps, missing, reason)


def rank(target: dict, candidates: list[dict], weights: dict[str, float], scales: dict[str, float],
         missing_penalty: float = DEFAULT_MISSING_PENALTY, min_coverage: float = 1.0) -> tuple[list[CandidateResult], list[CandidateResult], list[str]]:
    """Return (ranked results sorted by distance, excluded results, warnings)."""
    if not (0.0 < min_coverage <= 1.0):
        raise SimilarityError("min_coverage must be in (0, 1]")
    if not (missing_penalty >= 0 and math.isfinite(missing_penalty)):
        raise SimilarityError("missing_penalty must be a non-negative finite number")
    w = validate_weights(weights)
    warnings = []
    for key in list(w):
        if not target_usable(key, target):
            warnings.append(f"Feature '{key}' is unavailable for the target and was dropped: "
                            f"{target.get('missing_reasons', {}).get(key, 'no value')}")
            del w[key]
    if not w:
        raise SimilarityError("none of the selected features is available for this target")
    results = [score_candidate(target, c, w, scales, missing_penalty, min_coverage) for c in candidates]
    ranked = sorted((r for r in results if r.ranked), key=lambda r: (r.distance, r.location["id"]))
    excluded = sorted((r for r in results if not r.ranked), key=lambda r: r.location["id"])
    return ranked, excluded, warnings
