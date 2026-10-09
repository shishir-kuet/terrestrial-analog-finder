"""Offline build: acquire elevation windows, validate them, extract terrain
features and write the processed dataset consumed by the API.

    python -m pipeline.build              # build everything (uses cache)
    python -m pipeline.build --refresh    # ignore cached windows
    python -m pipeline.build --only targets,named,survey

Outputs (``data/processed``):
    locations.json   one record per target / Earth candidate
    manifest.json    build parameters, software versions, counts
    hillshade/*.png  hillshade previews generated from the same windows
Raw windows are cached in ``data/cache/windows`` (not committed).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

from app.features import (
    MIN_VALID_FRACTION,
    ROUGHNESS_KERNEL_PX,
    SCALAR_FEATURES,
    extract_features,
)
from pipeline import sources
from pipeline.sources import GRID_RES_M, WINDOW_SIZE_M, local_crs

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "data" / "sources"
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "data" / "processed"

DATASET_IDS = {
    "moon": "usgs-ard-barker-lola-south-pole-dtm",
    "mars": "usgs-ard-mro-ctx-controlled-dtm",
    "earth": "copernicus-dem-glo30",
}


# ----------------------------------------------------------------- helpers
def fetch_json(rel: str) -> dict:
    cache = CACHE / "stac" / rel.replace("/", "__")
    if cache.exists():
        return json.loads(cache.read_text())
    url = f"{sources.ASTROGEO_BASE}/{rel}"
    with urllib.request.urlopen(url, timeout=60) as r:
        data = json.loads(r.read())
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(data))
    return data


def hillshade_png(z: np.ndarray, res_m: float, path: Path, az=315.0, alt=45.0) -> None:
    """Standard Lambertian hillshade (illumination az 315, alt 45), grey
    where data are missing. Display only; never used in scoring."""
    gy, gx = np.gradient(np.where(np.isfinite(z), z, np.nanmedian(z)), res_m)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    azr, altr = math.radians(360 - az + 90), math.radians(alt)
    hs = np.sin(altr) * np.cos(slope) + np.cos(altr) * np.sin(slope) * np.cos(azr - aspect)
    img = (np.clip(hs, 0, 1) * 255).astype(np.uint8)
    img[~np.isfinite(z)] = 128
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img).resize((200, 200), Image.Resampling.BILINEAR).save(path, optimize=True)


def window_cache(loc_id: str) -> Path:
    return CACHE / "windows" / f"{loc_id}.npz"


def get_window(loc: dict, refresh: bool) -> tuple[np.ndarray, dict]:
    cp = window_cache(loc["id"])
    if cp.exists() and not refresh:
        d = np.load(cp, allow_pickle=False)
        return d["z"], json.loads(str(d["meta"]))
    if loc["body"] == "earth":
        w = sources.read_copernicus_window(loc["lat"], loc["lon"])
    else:
        w = sources.read_astrogeo_window(loc["body"], loc["dtm_url"], loc["lat"], loc["lon"], loc["source_res_m"])
    meta = {
        "source_urls": w.source_urls,
        "source_res_m": w.source_res_m,
        "resampling": w.resampling,
        "crs_proj4": w.crs_proj4,
    }
    cp.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cp, z=w.elevation, meta=json.dumps(meta))
    return w.elevation, meta


def offset_latlon(body: str, lat: float, lon: float, dx: float, dy: float) -> tuple[float, float]:
    from pyproj import CRS as PCRS, Transformer

    crs = PCRS.from_wkt(local_crs(body, lat, lon).to_wkt())
    t = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
    lo, la = t.transform(dx, dy)
    return float(la), float(lo)


# ------------------------------------------------------------ definitions
def load_targets() -> list[dict]:
    spec = json.loads((SRC_DIR / "targets.json").read_text())["targets"]
    out = []
    for t in spec:
        item = fetch_json(t["stac"])
        p = item["properties"]
        href = item["assets"]["dtm"]["href"]
        c = p["proj:centroid"]
        out.append(
            {
                "id": t["id"],
                "kind": "target",
                "body": t["body"],
                "name": t["name"],
                "lat": c["lat"],
                "lon": c["lon"],
                "coordinate_status": "derived_from_source_metadata",
                "coordinate_source": f"STAC item proj:centroid ({sources.ASTROGEO_BASE}/{t['stac']})",
                "dtm_url": href,
                "source_res_m": float(p["gsd"]),
                "source_item": {
                    "stac_url": f"{sources.ASTROGEO_BASE}/{t['stac']}",
                    "title": p.get("title"),
                    "license": p.get("license"),
                    "doi": p.get("sci:doi"),
                    "citation": p.get("sci:citation"),
                    "start": p.get("start_datetime"),
                    "end": p.get("end_datetime"),
                    "gsd_m": p.get("gsd"),
                },
                "selection_note": t.get("selection"),
            }
        )
    return out


def load_named() -> list[dict]:
    spec = json.loads((SRC_DIR / "earth_named_sites.json").read_text())
    return [
        {
            **s,
            "kind": "earth_named",
            "body": "earth",
            "coordinate_status": spec["coordinate_status"],
            "coordinate_source": "data/sources/earth_named_sites.json (approximate, unverified)",
        }
        for s in spec["sites"]
    ]


def survey_cells() -> list[dict]:
    regions = json.loads((SRC_DIR / "survey_regions.json").read_text())["regions"]
    out = []
    for r in regions:
        step = r["step"]
        nlat = int(round((r["lat"][1] - r["lat"][0]) / step))
        nlon = int(round((r["lon"][1] - r["lon"][0]) / step))
        for i in range(nlat):
            for j in range(nlon):
                la = r["lat"][0] + (i + 0.5) * step
                lo = r["lon"][0] + (j + 0.5) * step
                ns, ew = ("N" if la >= 0 else "S"), ("E" if lo >= 0 else "W")
                out.append(
                    {
                        "id": f"survey-{r['id']}-{abs(la):.1f}{ns}-{abs(lo):.1f}{ew}".replace(".", "p"),
                        "kind": "earth_survey",
                        "body": "earth",
                        "name": f"{r['name']} survey cell {abs(la):.1f}°{ns} {abs(lo):.1f}°{ew}",
                        "region": r["id"],
                        "lat": la,
                        "lon": lo,
                        "coordinate_status": "algorithmic_grid",
                        "coordinate_source": f"regular {step}° grid in survey region '{r['id']}' (data/sources/survey_regions.json)",
                    }
                )
    return out


# ----------------------------------------------------------------- process
def process(loc: dict, refresh: bool) -> dict:
    rec = {k: v for k, v in loc.items() if k not in ("dtm_url", "source_res_m")}
    try:
        z, meta = get_window(loc, refresh)
        cache_id = loc["id"]
        # Targets: if the footprint centroid window is incomplete, search
        # nearby centres (3/6 km offsets) for a fully covered window.
        if loc["kind"] == "target" and np.isfinite(z).mean() < MIN_VALID_FRACTION:
            best = (np.isfinite(z).mean(), z, meta, loc["lat"], loc["lon"])
            for r in (3000, 6000):
                for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)):
                    la, lo = offset_latlon(loc["body"], loc["lat"], loc["lon"], dx, dy)
                    alt = {**loc, "id": f"{loc['id']}__{dx}_{dy}", "lat": la, "lon": lo}
                    z2, m2 = get_window(alt, refresh)
                    if np.isfinite(z2).mean() > best[0]:
                        best = (np.isfinite(z2).mean(), z2, m2, la, lo)
                        cache_id = alt["id"]
                if best[0] >= MIN_VALID_FRACTION:
                    break
            _, z, meta, rec["lat"], rec["lon"] = best
            rec["coordinate_status"] = "derived_from_source_metadata_adjusted"
            rec["coordinate_source"] += " shifted to nearest fully covered window"
        fr = extract_features(z, GRID_RES_M)
        valid = z[np.isfinite(z)]
        rec.update(
            {
                "status": "ok" if fr.valid_fraction >= MIN_VALID_FRACTION else "insufficient_data",
                "valid_fraction": round(fr.valid_fraction, 4),
                "features": {k: (None if v is None else round(v, 4)) for k, v in fr.values.items()},
                "missing_reasons": fr.missing_reasons,
                "slope_hist": fr.slope_hist,
                "rel_elev_quantiles": fr.rel_elev_quantiles,
                "absolute_elevation_median_m": round(float(np.median(valid)), 1) if valid.size else None,
                "dataset_id": DATASET_IDS[loc["body"]],
                "processing": {
                    **meta,
                    "window_size_m": WINDOW_SIZE_M,
                    "grid_res_m": GRID_RES_M,
                    "window_px": int(z.shape[0]),
                    "window_cache_id": cache_id,
                },
            }
        )
        if valid.size:
            hillshade_png(z, GRID_RES_M, OUT / "hillshade" / f"{loc['id']}.png")
            rec["hillshade"] = f"hillshade/{loc['id']}.png"
    except Exception as exc:  # recorded, never silently dropped
        rec.update(
            {
                "status": "error",
                "error": f"{type(exc).__name__}: {exc}",
                "features": {k: None for k in SCALAR_FEATURES},
                "missing_reasons": {k: "source window could not be read" for k in SCALAR_FEATURES},
                "dataset_id": DATASET_IDS[loc["body"]],
            }
        )
    return rec


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--only", default="targets,named,survey")
    ap.add_argument("--workers", type=int, default=12)
    a = ap.parse_args(argv)
    parts = set(a.only.split(","))
    locs: list[dict] = []
    if "targets" in parts:
        locs += load_targets()
    if "named" in parts:
        locs += load_named()
    if "survey" in parts:
        locs += survey_cells()
    print(f"processing {len(locs)} locations", flush=True)

    existing = {}
    lp = OUT / "locations.json"
    if lp.exists() and parts != {"targets", "named", "survey"}:
        existing = {r["id"]: r for r in json.loads(lp.read_text())["locations"]}

    results = {}
    with ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(process, l, a.refresh): l["id"] for l in locs}
        for n, f in enumerate(as_completed(futs), 1):
            r = f.result()
            results[r["id"]] = r
            if n % 25 == 0 or r["status"] == "error":
                print(f"  {n}/{len(locs)} {r['id']} {r['status']} {r.get('error', '')}", flush=True)

    merged = {**existing, **results}
    order = sorted(merged.values(), key=lambda r: ({"target": 0, "earth_named": 1, "earth_survey": 2}[r["kind"]], r["id"]))
    OUT.mkdir(parents=True, exist_ok=True)
    lp.write_text(json.dumps({"locations": order}, separators=(",", ":")))
    counts: dict[str, dict[str, int]] = {}
    for r in order:
        counts.setdefault(r["kind"], {}).setdefault(r["status"], 0)
        counts[r["kind"]][r["status"]] += 1
    manifest = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "window_size_m": WINDOW_SIZE_M,
        "grid_res_m": GRID_RES_M,
        "min_valid_fraction": MIN_VALID_FRACTION,
        "roughness_kernel_px": ROUGHNESS_KERNEL_PX,
        "counts": counts,
        "software": {
            "python": sys.version.split()[0],
            "numpy": np.__version__,
            "rasterio": rasterio.__version__,
            "gdal": rasterio.__gdal_version__,
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(counts, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
