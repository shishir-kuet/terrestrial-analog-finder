"""API tests against the processed dataset shipped in data/processed."""

import math

from tests.conftest import ALL_WEIGHTS


def search(client, **kw):
    body = {"target_id": "moon-connecting-ridge", "weights": ALL_WEIGHTS} | kw
    return client.post("/api/similarity/search", json=body)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["locations"] > 0


def test_targets_and_filter(client):
    all_t = client.get("/api/targets").json()["targets"]
    moon = client.get("/api/targets?body=moon").json()["targets"]
    assert {t["body"] for t in moon} == {"moon"}
    assert len(moon) < len(all_t)
    assert client.get("/api/targets?body=venus").status_code == 422


def test_every_location_has_valid_coordinates_and_provenance(client, data):
    ids = {d["id"] for d in data.datasets["integrated"]}
    for r in data.locations.values():
        assert -90 <= r["lat"] <= 90 and -180 <= r["lon"] <= 180
        assert r["dataset_id"] in ids
        assert r["coordinate_status"] in {
            "derived_from_source_metadata", "derived_from_source_metadata_adjusted",
            "approximate_unverified", "algorithmic_grid",
        }
        assert r.get("coordinate_source")
        if r["status"] == "ok":
            assert r["processing"]["source_urls"], r["id"]
            assert r["processing"]["grid_res_m"] == 30.0
        if r["kind"] == "target":
            assert r["source_item"]["stac_url"].startswith("https://astrogeo-ard")
            assert r["source_item"]["license"] == "CC0-1.0"


def test_missing_values_are_null_with_reason(data):
    for r in data.locations.values():
        for k, v in r["features"].items():
            if v is None:
                assert r["missing_reasons"].get(k), (r["id"], k)
            else:
                assert math.isfinite(v)


def test_location_sources_endpoint(client):
    r = client.get("/api/locations/moon-connecting-ridge/sources").json()
    assert r["dataset"]["license"].startswith("CC0")
    assert r["source_item"]["doi"] == "10.5066/P13YV93V"
    assert client.get("/api/locations/nope/sources").status_code == 404


def test_location_features_endpoint(client):
    r = client.get("/api/locations/earth-meteor-crater/features").json()
    assert len(r["slope_hist"]) == 90 and abs(sum(r["slope_hist"]) - 1) < 1e-3
    assert len(r["rel_elev_quantiles"]) == 21
    assert "never compared" in r["absolute_elevation_note"]


def test_earth_candidate_endpoint_rejects_targets(client):
    assert client.get("/api/earth-candidates/moon-haworth").status_code == 404
    assert client.get("/api/earth-candidates/earth-haughton").status_code == 200


def test_search_returns_sorted_reproducible_ranking(client):
    a, b = search(client, limit=50).json(), search(client, limit=50).json()
    assert a["results"] == b["results"]
    d = [x["distance"] for x in a["results"]]
    assert d == sorted(d) and all(x >= 0 for x in d)
    assert [x["rank"] for x in a["results"]] == list(range(1, len(d) + 1))
    for x in a["results"]:
        assert math.isclose(x["similarity_index"], 100 * math.exp(-x["distance"]), rel_tol=1e-4)
        assert x["coverage"] == 1.0
        assert abs(sum(c["contribution_share"] for c in x["comparisons"]) - 1) < 1e-3
    assert abs(sum(a["config"]["normalized_weights"].values()) - 1) < 1e-9


def test_excluded_candidates_are_reported(client):
    r = search(client).json()
    assert r["excluded"], "dataset contains windows with insufficient data"
    assert all(x["exclusion_reason"] and x["rank"] is None for x in r["excluded"])
    assert "earth-askja" in {x["id"] for x in r["excluded"]}  # caldera lake masked


def test_search_validation_errors(client):
    assert search(client, weights={"slope_median_deg": 0}).status_code == 422
    assert search(client, weights={"slope_median_deg": -1}).status_code == 422
    assert search(client, weights={"albedo": 1}).status_code == 422
    assert search(client, target_id="earth-haughton").status_code == 404
    assert search(client, target_id="does-not-exist").status_code == 404
    assert search(client, min_coverage=0).status_code == 422
    assert search(client, min_coverage=1.5).status_code == 422
    assert search(client, limit=0).status_code == 422
    assert search(client, candidate_kinds=["target"]).status_code == 422
    assert search(client, candidate_kinds=["earth_survey"], regions=["nowhere"]).status_code == 422


def test_filters_restrict_candidates(client):
    r = search(client, candidate_kinds=["earth_named"], limit=100).json()
    assert {x["kind"] for x in r["results"]} == {"earth_named"}
    r = search(client, candidate_kinds=["earth_survey"], regions=["iceland"], limit=100).json()
    assert all(x["id"].startswith("survey-iceland") for x in r["results"])


def test_weight_change_changes_ranking_consistently(client):
    slope = search(client, weights={"slope_median_deg": 1}, limit=5).json()["results"]
    rough = search(client, weights={"roughness_rms_m": 1}, limit=5).json()["results"]
    assert slope[0]["id"] != rough[0]["id"]
    # the top result under a single feature has the smallest |difference| for it
    full = search(client, weights={"slope_median_deg": 1}, limit=600).json()["results"]
    diffs = [abs(x["comparisons"][0]["scaled_difference"]) for x in full]
    assert diffs == sorted(diffs)


def test_methodology_and_datasets(client):
    m = client.get("/api/methodology").json()
    assert "not a probability" in m["interpretation"]
    assert m["window"]["grid_res_m"] == 30.0
    ds = client.get("/api/datasets").json()
    # 3 terrain products (LOLA, CTX, Copernicus) + 5 thermal/mineral ones
    assert len(ds["integrated"]) == 8 and ds["investigated_not_integrated"]
    assert {d["id"] for d in ds["integrated"]} >= {
        "ecostress-l2t-lste-v002", "viirs-vnp43ma3-v002", "emit-l2b-min-v002",
        "mgs-tes-thermal-inertia-night", "lro-diviner-prp-south"}
    assert all(d["authentication"] for d in ds["integrated"])
    assert "environmental_layer" in m


def test_hillshade(client):
    r = client.get("/api/hillshade/moon-shackleton-rim.png")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert client.get("/api/hillshade/unknown.png").status_code == 404


def test_environment_endpoint_reports_coverage_and_scope(client):
    e = client.get("/api/environment").json()
    assert e["comparable_features"] == ["thermal_inertia_percentile"]
    assert e["earth_windows_with_thermal_feature"] <= e["earth_windows_ok"]
    assert "never used in scoring" in e["display_only"]


def test_thermal_feature_is_declared_but_carries_no_default_weight(client):
    defs = {f["key"]: f for f in client.get("/api/features").json()["features"]}
    f = defs["thermal_inertia_percentile"]
    assert f["default_weight"] == 0.0
    assert "Moon: not available" in f["method"]
    assert "not calibrated against each other" in f["limitations"]


def test_default_search_is_unchanged_by_the_environmental_layer(client):
    """The documented terrain-only ranking must still be what a default search
    returns: the thermal feature is only used when asked for."""
    r = search(client, limit=10).json()
    assert "thermal_inertia_percentile" not in r["config"]["weights"]
    assert all("thermal_inertia_percentile" not in c["missing_features"] for c in r["results"])


def test_search_reports_candidate_coverage_per_feature(client):
    r = search(client, weights={"slope_median_deg": 1}, limit=5).json()
    cov = r["config"]["candidate_coverage"]
    assert cov["slope_median_deg"] > 0


def test_location_features_include_the_environmental_block(client):
    r = client.get("/api/locations/mars-jezero/features").json()
    assert "environment" in r and "thermal_inertia_percentile" in r["environment_note"]
