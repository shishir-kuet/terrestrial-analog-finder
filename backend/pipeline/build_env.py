"""Offline build of the environmental (thermophysical and mineral) layer.

    python -m pipeline.build_env                     # all locations (resumable)
    python -m pipeline.build_env --only targets,named
    python -m pipeline.build_env --limit 50 --workers 16
    python -m pipeline.build_env --aggregate-only    # rewrite the output from the cache

Writes ``data/processed/environment.json``, which the API merges onto the
terrain records at load time. The terrain build is untouched, so the
terrain-only ranking stays exactly reproducible; this layer only adds
measurements and one comparable feature.

Per-location results are cached under ``data/cache/env`` so an interrupted run
resumes instead of re-downloading.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import rasterio

from pipeline import earthdata, environment as env
from pipeline.sources import local_crs

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "data" / "processed"
ENV_CACHE = CACHE / "env"

THERMAL_KEY = "thermal_inertia_percentile"

NO_LUNAR_TI = (
    "no thermal inertia product for the lunar south pole exists in the archives reachable here "
    "(PDS Geosciences LRO/Diviner holds brightness temperatures, rock abundance and modelled "
    "temperatures, not thermal inertia), so this feature is reported missing for Moon targets "
    "rather than substituted"
)


# ------------------------------------------------------------------- helpers
def _json_default(o):
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    raise TypeError(type(o))


def mars_ti_reference(cache: Path) -> dict:
    """Quantiles of the global TES nightside thermal inertia distribution.

    Used to express a Mars window's thermal inertia as a percentile of its own
    body, which is what makes it comparable with the Earth percentile.
    """
    path = cache / "tes" / "global_ti_night_reference.json"
    if path.exists():
        return json.loads(path.read_text())
    ti = env._tes_map(cache, env.TES_TI_URL, ">i2").astype("float32")
    v = ti[(ti >= env.TES_VALID_TIU[0]) & (ti <= env.TES_VALID_TIU[1])]
    qs = np.arange(0, 100.5, 0.5)
    ref = {
        "product": "MGS-M-TES-5-TIMAP-V1.0 global_ti_night_2007",
        "n_pixels": int(v.size),
        "quantile_percent": qs.tolist(),
        "quantile_value_tiu": np.percentile(v, qs).tolist(),
        "note": "percentiles of every valid pixel of the global nightside map (20 pix/deg)",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ref))
    return ref


def percentile_of(value: float, qs: list[float], vals: list[float]) -> float:
    """Where ``value`` falls in a distribution given by its quantiles."""
    return round(float(np.interp(value, vals, qs)), 2)


# ------------------------------------------------------------- per-location
def measure_earth(loc: dict) -> dict:
    lat, lon = loc["lat"], loc["lon"]
    crs = local_crs("earth", lat, lon)
    values: dict[str, float | None] = {}
    reasons: dict[str, str] = {}
    attrs: dict = {}
    prov: dict = {}

    day, day_meta = env.ecostress_side(lat, lon, crs, day=True)
    night, night_meta = env.ecostress_side(lat, lon, crs, day=False)
    prov["ecostress"] = {"day": day_meta, "night": night_meta,
                         "product": f"{env.ECO_SHORT} v{env.ECO_VERSION}",
                         "day_solar_hours": env.DAY_SOLAR_HOURS,
                         "night_solar_hours": env.NIGHT_SOLAR_HOURS}
    albedo, alb_meta = env.albedo_window(lat, lon, crs, CACHE)
    prov["albedo"] = {**alb_meta, "product": f"{env.ALBEDO_SHORT} v{env.ALBEDO_VERSION}",
                      "dates": [d[0] for d in env.ALBEDO_DATES]}

    if day is None or night is None:
        side = "day" if day is None else "night"
        n = (day_meta if day is None else night_meta)["n_scenes"]
        reasons["apparent_thermal_inertia"] = (
            f"fewer than {env.MIN_SCENES} usable ECOSTRESS {side} scenes in the required local-solar-time "
            f"window after cloud and water masking ({n} found)"
        )
    elif albedo is None:
        reasons["apparent_thermal_inertia"] = "no VNP43MA3 shortwave albedo passed quality screening over this window"
    else:
        dt_k = env.summarise(day - night)
        ati = env.summarise(env.apparent_thermal_inertia(day, night, albedo))
        if dt_k is None or ati is None:
            reasons["apparent_thermal_inertia"] = "day and night ECOSTRESS scenes overlap over too little of the window"
        else:
            values["apparent_thermal_inertia"] = ati["median"]
            attrs.update(
                {
                    "lst_day_median_k": round(float(np.nanmedian(day)), 2),
                    "lst_night_median_k": round(float(np.nanmedian(night)), 2),
                    "diurnal_lst_range_k": round(dt_k["median"], 2),
                    "albedo_shortwave_median": round(float(np.nanmedian(albedo)), 4),
                    "apparent_thermal_inertia_median": round(ati["median"], 6),
                    "apparent_thermal_inertia_p10": round(ati["p10"], 6),
                    "apparent_thermal_inertia_p90": round(ati["p90"], 6),
                    "thermal_valid_fraction": ati["valid_fraction"],
                    "thermal_n_scenes_day": day_meta["n_scenes"],
                    "thermal_n_scenes_night": night_meta["n_scenes"],
                }
            )

    minerals, min_meta = env.emit_mineral_window(lat, lon, crs, CACHE)
    prov["emit"] = {**min_meta, "product": f"{env.EMIT_SHORT} v{env.EMIT_VERSION}"}
    if minerals:
        attrs.update(minerals)
    else:
        reasons["mineral_classes"] = (
            "no EMIT L2B mineral granule covers at least "
            f"{env.EMIT_MIN_SWATH_COVERAGE:.0%} of this window "
            f"({min_meta['n_candidates']} candidate granules, "
            f"{min_meta['swath_coverage']:.0%} covered)"
        )
    return {"values": values, "missing_reasons": reasons, "attributes": attrs, "provenance": prov}


def measure_mars(loc: dict) -> dict:
    crs = local_crs("mars", loc["lat"], loc["lon"])
    ti, msk, meta = env.tes_thermal_inertia_window(loc["lat"], loc["lon"], crs, CACHE)
    s = env.summarise(ti)
    prov = {"tes": meta}
    if s is None:
        return {"values": {}, "missing_reasons": {"thermal_inertia_tiu": "no valid TES nightside thermal inertia over this window"},
                "attributes": {}, "provenance": prov}
    interp = float(np.nanmean(np.nan_to_num(msk, nan=1.0) == 0))
    return {
        "values": {"thermal_inertia_tiu": s["median"]},
        "missing_reasons": {},
        "attributes": {
            "thermal_inertia_median_tiu": round(s["median"], 1),
            "thermal_inertia_p10_tiu": round(s["p10"], 1),
            "thermal_inertia_p90_tiu": round(s["p90"], 1),
            "thermal_inertia_interpolated_area_fraction": round(interp, 4),
        },
        "provenance": prov,
    }


def measure_moon(loc: dict) -> dict:
    vals, meta = env.diviner_prp_window(loc["lat"], loc["lon"], CACHE)
    prov = {"diviner_prp": meta}
    if not vals:
        return {"values": {}, "missing_reasons": {THERMAL_KEY: NO_LUNAR_TI},
                "attributes": {}, "provenance": prov}
    return {
        "values": {},
        "missing_reasons": {THERMAL_KEY: NO_LUNAR_TI},
        "attributes": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in vals.items()},
        "provenance": prov,
    }


def measure(loc: dict) -> dict:
    cached = ENV_CACHE / f"{loc['id']}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    try:
        if loc["body"] == "earth":
            rec = measure_earth(loc)
        elif loc["body"] == "mars":
            rec = measure_mars(loc)
        else:
            rec = measure_moon(loc)
        rec["status"] = "ok"
    except Exception as exc:  # recorded, never silently dropped
        rec = {"values": {}, "missing_reasons": {}, "attributes": {}, "provenance": {},
               "status": "error", "error": f"{type(exc).__name__}: {exc}"}
    rec["id"] = loc["id"]
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(rec, default=_json_default))
    return rec


# ------------------------------------------------------------------- driver
def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="targets,named,survey")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--limit", type=int, default=0, help="process at most N locations (resumable)")
    ap.add_argument("--aggregate-only", action="store_true",
                    help="measure nothing; rewrite environment.json from the cache as it stands")
    a = ap.parse_args(argv)

    earthdata.configure_gdal()
    locs = json.loads((OUT / "locations.json").read_text())["locations"]
    want = set(a.only.split(","))
    kinds = {"target": "targets", "earth_named": "named", "earth_survey": "survey"}
    todo = [l for l in locs if kinds[l["kind"]] in want]
    pending = [] if a.aggregate_only else [l for l in todo if not (ENV_CACHE / f"{l['id']}.json").exists()]
    if a.limit:
        pending = pending[: a.limit]
    print(f"{len(todo)} locations selected, {len(pending)} to measure", flush=True)

    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", VSI_CACHE="TRUE",
                      GDAL_HTTP_MULTIPLEX="YES", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="2"):
        with ThreadPoolExecutor(a.workers) as ex:
            futs = {ex.submit(measure, l): l["id"] for l in pending}
            for n, f in enumerate(as_completed(futs), 1):
                rec = f.result()
                if n % 10 == 0 or rec["status"] != "ok":
                    print(f"  {n}/{len(pending)} {rec['id']} {rec['status']} {rec.get('error','')}", flush=True)

    records = {}
    for l in todo:
        p = ENV_CACHE / f"{l['id']}.json"
        if p.exists():
            records[l["id"]] = json.loads(p.read_text())

    # ---- percentiles (need the whole body's distribution, so: second pass)
    by_id = {l["id"]: l for l in locs}
    earth_ati = sorted(
        r["values"]["apparent_thermal_inertia"]
        for i, r in records.items()
        if by_id[i]["body"] == "earth" and r["values"].get("apparent_thermal_inertia") is not None
    )
    mars_ref = mars_ti_reference(CACHE) if any(by_id[i]["body"] == "mars" for i in records) else None
    qs = np.arange(0, 100.5, 0.5)
    earth_ref = {
        "quantile_percent": qs.tolist(),
        "quantile_value": (np.percentile(earth_ati, qs).tolist() if len(earth_ati) >= 20 else []),
        "n_windows": len(earth_ati),
        "note": "percentiles of the apparent thermal inertia of the Earth windows measured in this build, "
                "not of Earth as a whole: the pool is deliberately arid, volcanic and polar",
    }

    for loc_id, rec in records.items():
        body = by_id[loc_id]["body"]
        if body == "earth":
            v = rec["values"].get("apparent_thermal_inertia")
            if v is not None and earth_ref["quantile_value"]:
                rec["values"][THERMAL_KEY] = percentile_of(v, earth_ref["quantile_percent"], earth_ref["quantile_value"])
            elif v is not None:
                rec["missing_reasons"][THERMAL_KEY] = "too few Earth windows measured to define percentiles"
            else:
                rec["missing_reasons"][THERMAL_KEY] = rec["missing_reasons"].get(
                    "apparent_thermal_inertia", "no apparent thermal inertia for this window")
        elif body == "mars":
            v = rec["values"].get("thermal_inertia_tiu")
            if v is not None and mars_ref:
                rec["values"][THERMAL_KEY] = percentile_of(v, mars_ref["quantile_percent"], mars_ref["quantile_value_tiu"])
            else:
                rec["missing_reasons"][THERMAL_KEY] = rec["missing_reasons"].get(
                    "thermal_inertia_tiu", "no TES thermal inertia for this window")

    counts: dict[str, dict[str, int]] = {}
    for loc_id, rec in records.items():
        kind = by_id[loc_id]["kind"]
        has = "with_thermal_feature" if rec["values"].get(THERMAL_KEY) is not None else "without_thermal_feature"
        counts.setdefault(kind, {}).setdefault(has, 0)
        counts[kind][has] += 1
        if rec["attributes"].get("mineral_group2_dominant_class"):
            counts[kind]["with_minerals"] = counts[kind].get("with_minerals", 0) + 1

    doc = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "parameters": {
            "ecostress": {"product": f"{env.ECO_SHORT} v{env.ECO_VERSION}",
                          "day_solar_hours": list(env.DAY_SOLAR_HOURS),
                          "night_solar_hours": list(env.NIGHT_SOLAR_HOURS),
                          "min_scenes_per_side": env.MIN_SCENES, "max_scenes_per_side": env.MAX_SCENES,
                          "lst_valid_k": list(env.LST_VALID_K),
                          "min_scene_valid_fraction": env.MIN_SCENE_VALID_FRACTION},
            "albedo": {"product": f"{env.ALBEDO_SHORT} v{env.ALBEDO_VERSION}",
                       "field": env.ALBEDO_FIELD, "dates": [d[0] for d in env.ALBEDO_DATES]},
            "emit": {"product": f"{env.EMIT_SHORT} v{env.EMIT_VERSION}",
                     "min_swath_coverage": env.EMIT_MIN_SWATH_COVERAGE,
                     "max_granules": env.EMIT_MAX_GRANULES,
                     "class_rules": {name: list(keys) for name, keys in env.MINERAL_CLASS_RULES}},
            "tes": {"product": "MGS-M-TES-5-TIMAP-V1.0 global_ti_night_2007",
                    "valid_tiu": list(env.TES_VALID_TIU)},
            "diviner": {"product": "LRO-L-DLRE-5-PRP-V2.0 dlre_prp_south"},
        },
        "percentile_reference": {"earth": earth_ref, "mars": (
            {k: v for k, v in mars_ref.items() if k != "quantile_value_tiu"} | {"quantile_value": mars_ref["quantile_value_tiu"]}
            if mars_ref else None)},
        "counts": counts,
        "software": {"python": sys.version.split()[0], "numpy": np.__version__,
                     "rasterio": rasterio.__version__, "gdal": rasterio.__gdal_version__},
        "locations": records,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "environment.json").write_text(json.dumps(doc, separators=(",", ":"), default=_json_default))
    print(json.dumps(counts, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
