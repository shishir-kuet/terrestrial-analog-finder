"""Sensitivity of the rankings to weights, feature selection, grid resolution
and window size.

    python -m pipeline.sensitivity      (needs data/cache/windows from the build)

For every target, the baseline ranking (default weights, all Earth
candidates with complete windows) is compared with a perturbed ranking using
Spearman's rank correlation over the full candidate list and the overlap of
the two top-10 sets. Results are written to data/processed/sensitivity.json
and shown on the methodology page.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.features import extract_features
from app.registry import FEATURES
from app.similarity import compute_scales, rank
from app.store import Store

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "windows"
BASE_W = {k: f.default_weight for k, f in FEATURES.items()}


def spearman(a: list[str], b: list[str]) -> float:
    common = [x for x in a if x in set(b)]
    ra = {x: i for i, x in enumerate([x for x in a if x in common])}
    rb = {x: i for i, x in enumerate([x for x in b if x in common])}
    x = np.array([ra[c] for c in common], float)
    y = np.array([rb[c] for c in common], float)
    return float(np.corrcoef(x, y)[0, 1])


def order(target, pool, weights, scales):
    ranked, _, _ = rank(target, pool, weights, scales)
    return [r.location["id"] for r in ranked]


def compare(base: dict[str, list[str]], new: dict[str, list[str]]) -> dict:
    ts = [t for t in base if t in new]
    rho = [spearman(base[t], new[t]) for t in ts]
    top = [len(set(base[t][:10]) & set(new[t][:10])) for t in ts]
    return {"median_spearman": float(np.median(rho)), "min_spearman": float(np.min(rho)),
            "median_top10_overlap": float(np.median(top)), "min_top10_overlap": int(np.min(top)), "n_targets": len(ts),
            "targets_without_valid_window": sorted(set(base) - set(ts))}


def refeature(locs: list[dict], fn) -> list[dict]:
    """Recompute features from cached windows after transforming them."""
    out = []
    for r in locs:
        z = np.load(CACHE / f"{r['processing'].get('window_cache_id', r['id'])}.npz")["z"]
        z2, res = fn(z)
        fr = extract_features(z2, res)
        out.append({**r, "features": fr.values, "missing_reasons": fr.missing_reasons, "slope_hist": fr.slope_hist,
                    "status": "ok" if all(v is not None for v in fr.values.values()) or fr.valid_fraction >= 0.95 else "insufficient_data"})
    return out


def block_mean(z: np.ndarray, k: int) -> np.ndarray:
    n = (z.shape[0] // k) * k
    b = z[:n, :n].reshape(n // k, k, n // k, k)
    valid = np.isfinite(b).all(axis=(1, 3))
    return np.where(valid, np.where(np.isfinite(b), b, 0).mean(axis=(1, 3)), np.nan)


def main() -> int:
    st = Store()
    targets = [t for t in st.targets if t["status"] == "ok"]
    pool = st.reference_pool
    scales = st.scales
    base = {t["id"]: order(t, pool, BASE_W, scales) for t in targets}
    experiments = []

    rng = np.random.default_rng(2026)
    draws = []
    for _ in range(20):
        w = {k: v * float(rng.uniform(0.5, 1.5)) for k, v in BASE_W.items()}
        draws.append(compare(base, {t["id"]: order(t, pool, w, scales) for t in targets}))
    experiments.append({"name": "Random weight perturbation (each weight x U[0.5, 1.5], 20 draws; medians of per-draw medians)",
                        **{k: float(np.median([d[k] for d in draws])) for k in draws[0] if k != "targets_without_valid_window"},
                        "targets_without_valid_window": []})

    for k in FEATURES:
        w = {kk: v for kk, v in BASE_W.items() if kk != k}
        experiments.append({"name": f"Drop feature: {FEATURES[k].label}",
                            **compare(base, {t["id"]: order(t, pool, w, scales) for t in targets})})

    for label, fn in [
        ("Coarser grid: 90 m (3x3 block mean of the 30 m windows)", lambda z: (block_mean(z, 3), 90.0)),
        ("Smaller window: central 6 km x 6 km", lambda z: (z[100:300, 100:300], 30.0)),
    ]:
        p2 = [r for r in refeature(pool, fn) if r["status"] == "ok"]
        t2 = refeature(targets, fn)
        s2 = compute_scales(p2)
        new = {t["id"]: order(t, p2, BASE_W, s2) for t in t2 if t["status"] == "ok"}
        experiments.append({"name": label, **compare(base, new)})

    out = {
        "description": "Agreement between the default ranking and perturbed rankings, over all targets. "
                       "Spearman rho is computed over every candidate ranked in both runs; top-10 overlap counts shared candidates.",
        "baseline": {"weights": BASE_W, "n_targets": len(targets), "pool_size": len(pool)},
        "experiments": experiments,
    }
    (ROOT / "data" / "processed" / "sensitivity.json").write_text(json.dumps(out, indent=2))
    for e in experiments:
        print(f"{e['median_spearman']:.3f} {e['median_top10_overlap']:4.1f}  {e['name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
