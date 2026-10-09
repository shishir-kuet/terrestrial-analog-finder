"""FastAPI application: Terrestrial Analog Finder API."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import features as fx
from app.registry import FEATURES
from app.schemas import CandidateOut, FeatureComparisonOut, SearchRequest, SearchResponse
from app.similarity import DEFAULT_MISSING_PENALTY, CandidateResult, SimilarityError, rank
from app.store import DataUnavailable, Store

app = FastAPI(
    title="Terrestrial Analog Finder API",
    version="0.1.0",
    description="Ranks Earth locations by terrain similarity to lunar and Martian reference regions. "
    "Similarity indices are descriptive, not probabilities, and do not indicate mission suitability.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("TAF_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

store = Store()

INTERPRETATION = (
    "Similarity index S = 100 x exp(-D), where D is the weighted RMS of robust-scaled feature differences "
    "(units: inter-quartile ranges of the Earth reference pool). S = 100 means identical values for the selected "
    "features; S ~ 37 means the features differ by one IQR on average. S is not a probability and is comparable "
    "only between results computed with the same target, features, weights and data build."
)


@app.exception_handler(DataUnavailable)
async def _data_unavailable(_, exc: DataUnavailable):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def _summary(r: dict) -> dict:
    keys = ("id", "name", "kind", "body", "lat", "lon", "coordinate_status", "status", "valid_fraction",
            "features", "missing_reasons", "dataset_id", "hillshade", "region", "analog_context")
    return {k: r.get(k) for k in keys}


def _get(loc_id: str) -> dict:
    r = store.locations.get(loc_id)
    if r is None:
        raise HTTPException(404, f"unknown location id '{loc_id}'")
    return r


@app.get("/api/health")
def health():
    try:
        n = len(store.locations)
        return {"status": "ok", "locations": n, "built_at": store.manifest.get("built_at")}
    except DataUnavailable as e:
        return JSONResponse(status_code=503, content={"status": "degraded", "detail": str(e)})


@app.get("/api/datasets")
def datasets():
    return store.datasets


@app.get("/api/features")
def feature_defs():
    return {"features": [f.to_dict() for f in FEATURES.values()], "scales": store.scales}


@app.get("/api/targets")
def targets(body: str | None = Query(None, pattern="^(moon|mars)$")):
    return {"targets": [_summary(t) | {"source_item": t.get("source_item"), "selection_note": t.get("selection_note")}
                        for t in store.targets if body is None or t["body"] == body]}


@app.get("/api/earth-candidates")
def earth_candidates(kind: str | None = Query(None, pattern="^(earth_named|earth_survey)$"),
                     region: str | None = None, status: str | None = Query(None, pattern="^(ok|insufficient_data|error)$")):
    out = [
        _summary(r) for r in store.earth
        if (kind is None or r["kind"] == kind) and (region is None or r.get("region") == region)
        and (status is None or r["status"] == status)
    ]
    return {"count": len(out), "candidates": out}


@app.get("/api/regions")
def regions():
    import json

    spec = json.loads((store.sources / "survey_regions.json").read_text())
    return spec


@app.get("/api/locations/{loc_id}")
def location(loc_id: str):
    return _get(loc_id)


@app.get("/api/earth-candidates/{loc_id}")
def earth_candidate(loc_id: str):
    r = _get(loc_id)
    if r["body"] != "earth":
        raise HTTPException(404, f"'{loc_id}' is not an Earth candidate")
    return r


@app.get("/api/locations/{loc_id}/features")
def location_features(loc_id: str):
    r = _get(loc_id)
    return {
        "id": r["id"],
        "features": r["features"],
        "missing_reasons": r.get("missing_reasons", {}),
        "slope_hist": r.get("slope_hist"),
        "rel_elev_quantiles": r.get("rel_elev_quantiles"),
        "absolute_elevation_median_m": r.get("absolute_elevation_median_m"),
        "absolute_elevation_note": "Reported for context only and never compared: vertical datums differ between bodies.",
    }


@app.get("/api/locations/{loc_id}/sources")
def location_sources(loc_id: str):
    r = _get(loc_id)
    return {
        "id": r["id"],
        "dataset": store.dataset(r["dataset_id"]),
        "source_item": r.get("source_item"),
        "coordinate_status": r.get("coordinate_status"),
        "coordinate_source": r.get("coordinate_source"),
        "processing": r.get("processing"),
    }


@app.get("/api/hillshade/{loc_id}.png")
def hillshade(loc_id: str):
    r = _get(loc_id)
    if not r.get("hillshade"):
        raise HTTPException(404, "no hillshade for this location")
    return FileResponse(store.processed / r["hillshade"], media_type="image/png")


def _out(res: CandidateResult, rank_no: int | None) -> CandidateOut:
    loc = res.location
    d2 = sum(c.contribution for c in res.comparisons) or 1.0
    return CandidateOut(
        rank=rank_no, id=loc["id"], name=loc["name"], kind=loc["kind"], lat=loc["lat"], lon=loc["lon"],
        coordinate_status=loc.get("coordinate_status", "unknown"),
        distance=round(res.distance, 6), similarity_index=round(res.similarity_index, 3),
        coverage=round(res.coverage, 4), missing_features=res.missing_features,
        comparisons=[FeatureComparisonOut(**c.__dict__, contribution_share=round(c.contribution / d2, 4))
                     for c in res.comparisons],
        dataset_id=loc["dataset_id"], hillshade=loc.get("hillshade"), exclusion_reason=res.exclusion_reason,
    )


@app.post("/api/similarity/search", response_model=SearchResponse)
def search(req: SearchRequest):
    target = store.locations.get(req.target_id)
    if target is None or target["kind"] != "target":
        raise HTTPException(404, f"unknown target '{req.target_id}'")
    if target["status"] != "ok":
        raise HTTPException(422, f"target '{req.target_id}' has insufficient data: {target.get('error', '')}")
    cands = [
        r for r in store.earth
        if r["kind"] in req.candidate_kinds
        and (req.regions is None or r["kind"] != "earth_survey" or r.get("region") in req.regions)
    ]
    if not cands:
        raise HTTPException(422, "no Earth candidates match the selected filters")
    try:
        ranked, excluded, warnings = rank(target, cands, req.weights, store.scales,
                                          req.missing_penalty, req.min_coverage)
    except SimilarityError as e:
        raise HTTPException(422, str(e)) from e
    used = {c.key: c.weight for c in (ranked or excluded)[0].comparisons}
    tw = sum(used.values())
    return SearchResponse(
        target=_summary(target) | {"slope_hist": target.get("slope_hist"),
                                   "rel_elev_quantiles": target.get("rel_elev_quantiles")},
        config={
            "weights": used,
            "normalized_weights": {k: v / tw for k, v in used.items()},
            "scales": {k: store.scales[k] for k in used},
            "transforms": {k: FEATURES[k].transform for k in used},
            "min_coverage": req.min_coverage,
            "missing_penalty": req.missing_penalty,
            "reference_pool_size": len(store.reference_pool),
            "data_built_at": store.manifest.get("built_at"),
        },
        results=[_out(r, i + 1) for i, r in enumerate(ranked[: req.limit])],
        excluded=[_out(r, None) for r in excluded[:100]],
        n_candidates_considered=len(cands),
        warnings=warnings,
        interpretation=INTERPRETATION,
    )


@app.get("/api/methodology")
def methodology():
    m = store.manifest
    return {
        "summary": "Terrain-only comparison of 12 km x 12 km windows resampled to a common 30 m local grid.",
        "window": {"size_m": m["window_size_m"], "grid_res_m": m["grid_res_m"],
                   "projection": "local azimuthal equidistant centred on each location (body-specific figure)",
                   "min_valid_fraction": fx.MIN_VALID_FRACTION},
        "features": [f.to_dict() for f in FEATURES.values()],
        "normalization": "Robust scaling: each (transformed) feature difference is divided by the inter-quartile "
                         "range of that feature over the fixed Earth reference pool (all complete Earth windows).",
        "distance": "D = sqrt((sum_avail w_i d_i^2 + sum_missing w_i P^2) / sum_all w_i)",
        "similarity_index": "S = 100 * exp(-D)",
        "missing_data_policy": f"Missing candidate features are reported and counted as a mismatch of P "
                               f"(default {DEFAULT_MISSING_PENALTY} IQRs). Candidates whose weighted coverage is "
                               "below min_coverage (default 100 %) are not ranked. Missing target features are "
                               "dropped from the request with a warning. Missing values are never zero-filled.",
        "weights": "Non-negative, finite; all-zero rejected; normalised to sum to 1 for reporting.",
        "interpretation": INTERPRETATION,
        "manifest": m,
        "sensitivity": store.sensitivity,
    }


# Serve the built frontend when present (single-process demo / Docker).
_dist = Path(os.environ.get("TAF_FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
