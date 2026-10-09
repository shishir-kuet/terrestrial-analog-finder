"""Environmental (thermophysical and mineralogical) measurements per window.

Each reader returns measurements on the same 12 km x 12 km window grid used for
terrain, so the comparison unit does not change. Nothing here is interpolated
across bodies: every number is reduced from one named product, and a window with
too little valid data returns ``None`` with a reason.

Products read (all verified by downloading real granules; see
``docs/DATA_SOURCES.md`` for the full dataset records):

Earth
    ECOSTRESS ``ECO_L2T_LSTE`` v002 land-surface temperature (70 m, K) - day and
    night scenes, cloud/water masked, reduced to per-pixel medians.
    VIIRS/NPP ``VNP43MA3`` v002 white-sky shortwave albedo (1 km, unitless).
    EMIT ``EMITL2BMIN`` v002 mineral identification (60 m, categorical).
Mars
    MGS TES derived thermal inertia maps (``MGS-M-TES-5-TIMAP-V1.0``), nightside,
    20 pix/deg, J m^-2 K^-1 s^-1/2 ("tiu").
Moon
    LRO Diviner Polar Resource Product (``dlre_prp_south``) - modelled annual
    average (2 cm depth) and maximum (surface) temperature and water-ice
    stability depth on a ~240 m triangular mesh.
"""

from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

from pipeline import earthdata, sources
from pipeline.sources import N_PX, WINDOW_SIZE_M, local_crs

# --------------------------------------------------------------- parameters
ECO_SHORT, ECO_VERSION = "ECO_L2T_LSTE", "002"
ALBEDO_SHORT, ALBEDO_VERSION = "VNP43MA3", "002"
EMIT_SHORT, EMIT_VERSION = "EMITL2BMIN", "002"

# Local solar time windows. ECOSTRESS flies on the ISS, so overpass time
# precesses; restricting the scenes keeps the day-night difference meaningful.
DAY_SOLAR_HOURS = (11.0, 16.0)
NIGHT_SOLAR_HOURS = (22.0, 5.0)  # wraps midnight
LST_VALID_K = (200.0, 360.0)
MIN_SCENE_VALID_FRACTION = 0.40  # of the window, after masking
MIN_SCENES = 3  # per day/night side
MAX_SCENES = 4
MAX_CANDIDATE_SCENES = 40  # CMR hits inspected per side before giving up
MIN_THERMAL_VALID_FRACTION = 0.60  # of the window, for the day-night pair

ALBEDO_SCALE, ALBEDO_FILL = 0.001, 32767
ALBEDO_DATES = (("2022-01-01", "2022-01-02"), ("2022-07-01", "2022-07-02"))
ALBEDO_FIELD = "HDFEOS/GRIDS/VIIRS_Grid_BRDF/Data Fields/Albedo_WSA_shortwave"
ALBEDO_QA_FIELD = "HDFEOS/GRIDS/VIIRS_Grid_BRDF/Data Fields/BRDF_Albedo_Band_Mandatory_Quality_shortwave"
SIN_CRS = CRS.from_proj4("+proj=sinu +lon_0=0 +x_0=0 +y_0=0 +R=6371007.181 +units=m +no_defs")
SIN_TILE_M = 1111950.5196666666
SIN_TILE_PX = 1200

TES_TI_URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img"
TES_MASK_URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_msk_night_2007.img"
TES_SHAPE = (3600, 7200)  # lines, samples; 20 pix/deg simple cylindrical
TES_PPD = 20.0
TES_VALID_TIU = (5.0, 5000.0)  # the derived range stated in the archive readme
MARS_RADIUS_M = 3_396_000.0  # A_AXIS_RADIUS in the TES map label (not the DTM sphere)

DIVINER_PRP_SOUTH_URL = (
    "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/"
    "data_derived_prp/dlre_prp_south.tab"
)
DIVINER_PRP_INVALID = -999.0
DIVINER_SEARCH_RADIUS_M = WINDOW_SIZE_M * 0.75  # half-diagonal of the window

# Mineral classes. EMIT L2B reports the best-matching entry of a spectral
# library per pixel; these rules group those library names into classes by
# substring. The rules are ours, not EMIT's, and are reported with the data.
MINERAL_CLASS_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("hematite", ("hematite",)),
    ("goethite", ("goethite", "goeth")),
    ("kaolinite", ("kaol",)),
    ("smectite", ("montmor", "nontronite", "beidellite", "smectite", "saponite")),
    ("illite_muscovite", ("illite", "musc")),
    ("chlorite", ("chlor",)),
    ("vermiculite", ("vermiculite",)),
    ("gypsum", ("gypsum",)),
    ("other_sulfate", ("sulfate", "alun", "jarosite", "copiapite")),
    ("calcite", ("calcite",)),
    ("dolomite", ("dolomite",)),
    ("other_carbonate", ("carbonate",)),
    ("other_iron_bearing", ("fe3+", "fe2+")),
)
MINERAL_CLASSES = tuple(name for name, _ in MINERAL_CLASS_RULES) + ("other",)


def mineral_class(library_name: str) -> str:
    low = library_name.lower()
    for name, keys in MINERAL_CLASS_RULES:
        if any(k in low for k in keys):
            return name
    return "other"


@dataclass
class Measurement:
    """One reduced measurement set for a window, or an explained absence."""

    values: dict[str, float | None] = field(default_factory=dict)
    missing_reasons: dict[str, str] = field(default_factory=dict)
    provenance: dict = field(default_factory=dict)


# ----------------------------------------------------------------- ECOSTRESS
def local_solar_hour(iso_utc: str, lon_deg: float) -> float:
    """Mean local solar hour (0-24) of a UTC timestamp at a longitude."""
    t = dt.datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    return (t.hour + t.minute / 60 + t.second / 3600 + lon_deg / 15.0) % 24.0


def in_solar_window(hour: float, span: tuple[float, float]) -> bool:
    lo, hi = span
    return lo <= hour <= hi if lo <= hi else (hour >= lo or hour <= hi)


def _ecostress_scene(granule: dict, dst_crs: CRS) -> np.ndarray | None:
    """Masked LST (K) for one scene on the window grid, or None if unusable."""
    lst_url = earthdata.asset(granule, "_LST.tif")
    if not lst_url:
        return None
    lst = sources.read_window(lst_url, dst_crs, src_res_m=70.0)
    bad = ~np.isfinite(lst) | (lst < LST_VALID_K[0]) | (lst > LST_VALID_K[1])
    for suffix in ("_cloud.tif", "_water.tif"):
        url = earthdata.asset(granule, suffix)
        if url:
            flag = sources.read_window(url, dst_crs, src_res_m=70.0, resampling=rasterio.enums.Resampling.nearest)
            bad |= np.nan_to_num(flag, nan=0.0) > 0
    out = np.where(bad, np.nan, lst).astype("float32")
    return out if np.isfinite(out).mean() >= MIN_SCENE_VALID_FRACTION else None


def ecostress_side(lat: float, lon: float, dst_crs: CRS, *, day: bool) -> tuple[np.ndarray | None, dict]:
    """Per-pixel median LST over accepted day (or night) ECOSTRESS scenes."""
    bbox = sources.window_bbox_latlon("earth", lat, lon, pad_m=200.0)
    span = DAY_SOLAR_HOURS if day else NIGHT_SOLAR_HOURS
    granules = earthdata.search_granules(
        ECO_SHORT, ECO_VERSION, bbox=bbox, day_night="day" if day else "night",
        page_size=MAX_CANDIDATE_SCENES,
    )
    scenes: list[np.ndarray] = []
    used: list[dict] = []
    for g in granules:
        if len(scenes) >= MAX_SCENES:
            break
        if not g.get("start"):
            continue
        hour = local_solar_hour(g["start"], lon)
        if not in_solar_window(hour, span):
            continue
        try:
            scene = _ecostress_scene(g, dst_crs)
        except (rasterio.errors.RasterioIOError, rasterio.errors.RasterioError):
            continue
        if scene is None:
            continue
        scenes.append(scene)
        used.append({"granule_id": g["granule_id"], "start": g["start"], "local_solar_hour": round(hour, 2)})
    if len(scenes) < MIN_SCENES:
        return None, {"scenes_used": used, "n_scenes": len(scenes), "n_candidates": len(granules)}
    stack = np.stack(scenes)
    with np.errstate(all="ignore"):
        med = np.nanmedian(stack, axis=0).astype("float32")
    med[np.isnan(stack).all(axis=0)] = np.nan
    return med, {"scenes_used": used, "n_scenes": len(scenes), "n_candidates": len(granules)}


# -------------------------------------------------------------------- albedo
def sinusoidal_tile(lat: float, lon: float) -> tuple[int, int]:
    x, y = rasterio.warp.transform("EPSG:4326", SIN_CRS, [lon], [lat])
    h = int((x[0] + 18 * SIN_TILE_M) // SIN_TILE_M)
    v = int((9 * SIN_TILE_M - y[0]) // SIN_TILE_M)
    return h, v


def _albedo_tile_array(path: Path) -> np.ndarray:
    import h5py

    with h5py.File(path, "r") as f:
        raw = f[ALBEDO_FIELD][:]
        qa = f[ALBEDO_QA_FIELD][:]
    a = raw.astype("float32")
    a[(raw == ALBEDO_FILL) | (qa > 0)] = np.nan  # quality 0 = full BRDF inversion
    return a * ALBEDO_SCALE


def albedo_window(lat: float, lon: float, dst_crs: CRS, cache: Path) -> tuple[np.ndarray | None, dict]:
    """Median white-sky shortwave albedo on the window grid, from VNP43MA3."""
    bbox = sources.window_bbox_latlon("earth", lat, lon, pad_m=2000.0)
    tiles: list[np.ndarray] = []
    used: list[str] = []
    for start, end in ALBEDO_DATES:
        granules = earthdata.search_granules(
            ALBEDO_SHORT, ALBEDO_VERSION, bbox=bbox, temporal=(f"{start}T00:00:00Z", f"{end}T00:00:00Z"),
            page_size=10,
        )
        for g in granules:
            url = earthdata.asset(g, ".h5")
            if not url:
                continue
            npz = cache / "albedo" / f"{g['granule_id']}.npy"
            if not npz.exists():
                h5 = cache / "albedo" / f"{g['granule_id']}.h5"
                earthdata.download(url, h5)
                try:
                    arr = _albedo_tile_array(h5)
                finally:
                    h5.unlink(missing_ok=True)
                npz.parent.mkdir(parents=True, exist_ok=True)
                np.save(npz, arr)
            arr = np.load(npz)
            h, v = _tile_from_granule_id(g["granule_id"])
            if h is None:
                continue
            tr = from_origin(
                -18 * SIN_TILE_M + h * SIN_TILE_M,
                9 * SIN_TILE_M - v * SIN_TILE_M,
                SIN_TILE_M / SIN_TILE_PX,
                SIN_TILE_M / SIN_TILE_PX,
            )
            w = sources.warp_array(arr, tr, SIN_CRS, dst_crs, src_res_m=SIN_TILE_M / SIN_TILE_PX)
            if np.isfinite(w).any():
                tiles.append(w)
                used.append(g["granule_id"])
            break  # one granule per date is enough for a 12 km window
    if not tiles:
        return None, {"granules_used": used}
    with np.errstate(all="ignore"):
        med = np.nanmedian(np.stack(tiles), axis=0).astype("float32")
    return med, {"granules_used": used}


def _tile_from_granule_id(granule_id: str | None) -> tuple[int | None, int | None]:
    for part in (granule_id or "").split("."):
        if len(part) == 6 and part[0] == "h" and part[3] == "v" and part[1:3].isdigit() and part[4:].isdigit():
            return int(part[1:3]), int(part[4:])
    return None, None


# ------------------------------------------------------------- Mars TES maps
def _tes_map(cache: Path, url: str, dtype: str) -> np.ndarray:
    name = url.rsplit("/", 1)[-1]
    path = earthdata.download(url, cache / "tes" / name)
    return np.memmap(path, dtype=dtype, mode="r").reshape(TES_SHAPE)


def tes_thermal_inertia_window(lat: float, lon: float, dst_crs: CRS, cache: Path) -> tuple[np.ndarray | None, np.ndarray | None, dict]:
    """TES nightside thermal inertia (tiu) and interpolation mask on the grid."""
    ti = _tes_map(cache, TES_TI_URL, ">i2").astype("float32")
    msk = _tes_map(cache, TES_MASK_URL, ">i1").astype("float32")
    ti[(ti < TES_VALID_TIU[0]) | (ti > TES_VALID_TIU[1])] = np.nan
    res_m = 2 * math.pi * MARS_RADIUS_M / (360.0 * TES_PPD)
    tr = from_origin(-180.0, 90.0, 1 / TES_PPD, 1 / TES_PPD)
    src_crs = CRS.from_proj4(f"+proj=longlat +R={MARS_RADIUS_M:.0f} +no_defs")
    w_ti = sources.warp_array(ti, tr, src_crs, dst_crs, src_res_m=res_m)
    w_msk = sources.warp_array(msk, tr, src_crs, dst_crs, src_res_m=res_m,
                               resampling=rasterio.enums.Resampling.nearest)
    meta = {
        "product": "MGS-M-TES-5-TIMAP-V1.0 global_ti_night_2007",
        "source_resolution_m": round(res_m, 1),
        "source_pixels_in_window": round((WINDOW_SIZE_M / res_m) ** 2, 2),
    }
    return w_ti, w_msk, meta


# ---------------------------------------------------------- Moon Diviner PRP
def _diviner_prp_table(cache: Path) -> np.ndarray:
    """Columns (clon, clat, temp_avg, temp_max, ice_depth) of the PRP table."""
    npy = cache / "diviner" / "dlre_prp_south.npy"
    if npy.exists():
        return np.load(npy)
    tab = earthdata.download(DIVINER_PRP_SOUTH_URL, cache / "diviner" / "dlre_prp_south.tab")
    rows = np.loadtxt(tab, delimiter=",", skiprows=1, usecols=(9, 10, 12, 13, 14), dtype="float64")
    npy.parent.mkdir(parents=True, exist_ok=True)
    np.save(npy, rows)
    return rows


def diviner_prp_window(lat: float, lon: float, cache: Path) -> tuple[dict[str, float | None], dict]:
    """Median PRP quantities over the window, from the triangular mesh centres.

    The product is a mesh, not a raster, so the window is sampled by selecting
    mesh facets whose centre falls inside the 12 km square (in the window's own
    projection) rather than by resampling.
    """
    rows = _diviner_prp_table(cache)
    crs = local_crs("moon", lat, lon)
    sel = rows[(rows[:, 1] <= lat + 1.0) & (rows[:, 1] >= lat - 1.0)]
    if sel.size == 0:
        return {}, {"n_facets": 0}
    x, y = rasterio.warp.transform(CRS.from_proj4("+proj=longlat +R=1737400 +no_defs"), crs,
                                   sel[:, 0].tolist(), sel[:, 1].tolist())
    x, y = np.asarray(x), np.asarray(y)
    half = WINDOW_SIZE_M / 2
    inside = (np.abs(x) <= half) & (np.abs(y) <= half)
    sel = sel[inside]
    if sel.shape[0] < 50:
        return {}, {"n_facets": int(sel.shape[0])}
    # ice_depth: -999 means "deeper than 2.8738 m" per the product label; -1
    # occurs in 3.5 % of the table and is not documented there, so both are
    # treated as not reported rather than guessed at.
    ice = sel[:, 4]
    stable = ice >= 0.0
    return (
        {
            "lunar_temp_annual_avg_k": float(np.median(sel[:, 2])),
            "lunar_temp_annual_max_k": float(np.median(sel[:, 3])),
            "lunar_ice_stable_area_fraction": round(float(stable.mean()), 4),
            "lunar_ice_stability_depth_m": float(np.median(ice[stable])) if stable.any() else None,
        },
        {"n_facets": int(sel.shape[0]), "product": "LRO-L-DLRE-5-PRP-V2.0 dlre_prp_south"},
    )


# --------------------------------------------------------------- EMIT minerals
EMIT_MAX_GRANULES = 3
EMIT_MIN_SWATH_COVERAGE = 0.50
EMIT_NO_IDENTIFICATION = -1


def _emit_granule_window(path: Path, lat: float, dst_crs: CRS) -> tuple[np.ndarray, dict[int, np.ndarray]]:
    """(inside-swath mask, class code per EMIT mineral group) for one granule.

    EMIT L2B reports two independent identifications per pixel: group 1 covers
    the iron-bearing minerals diagnosed in the visible/near-infrared and group 2
    the clays, carbonates and sulfates diagnosed in the shortwave infrared. Both
    are kept, because group 1 alone is hematite almost everywhere.

    Code ``EMIT_NO_IDENTIFICATION`` marks a pixel inside the swath where no
    group-1 mineral was identified: that is a measurement ("no diagnostic
    absorption found"), not missing data, so it is kept separate from the gap
    outside the swath.
    """
    import h5py

    with h5py.File(path, "r") as f:
        gt = np.asarray(f.attrs["geotransform"], dtype="float64")
        glt_x, glt_y = f["location/glt_x"][:], f["location/glt_y"][:]
        groups = {n: (f[f"group_{n}_mineral_id"][:], f[f"group_{n}_band_depth"][:]) for n in (1, 2)}
        names = [n.decode() if isinstance(n, bytes) else str(n) for n in f["mineral_metadata/name"][:]]
        index = f["mineral_metadata/index"][:]
    classes = {int(i): mineral_class(n) for i, n in zip(index, names)}
    code_of = {c: k for k, c in enumerate(MINERAL_CLASSES)}
    # GLT holds 1-based sensor coordinates for each orthorectified cell.
    inside = (glt_x > 0) & (glt_y > 0)
    tr = rasterio.transform.Affine(gt[1], gt[2], gt[0], gt[4], gt[5], gt[3])
    res_m = abs(gt[1]) * 111_320.0 * math.cos(math.radians(lat))
    nearest = rasterio.enums.Resampling.nearest
    out: dict[int, np.ndarray] = {}
    for n, (mid, depth) in groups.items():
        ids = mid[glt_y[inside] - 1, glt_x[inside] - 1]
        bd = depth[glt_y[inside] - 1, glt_x[inside] - 1]
        codes = np.full(ids.shape, EMIT_NO_IDENTIFICATION, dtype="int16")
        for raw_id in np.unique(ids):
            if raw_id > 0:
                codes[ids == raw_id] = code_of[classes.get(int(raw_id), "other")]
        codes[~np.isfinite(bd) | (bd <= 0)] = EMIT_NO_IDENTIFICATION
        ortho = np.full(glt_x.shape, np.nan, dtype="float32")
        ortho[inside] = codes
        out[n] = sources.warp_array(ortho, tr, "EPSG:4326", dst_crs, src_res_m=res_m, resampling=nearest)
    inside_w = sources.warp_array(inside.astype("float32"), tr, "EPSG:4326", dst_crs,
                                  src_res_m=res_m, resampling=nearest)
    return np.nan_to_num(inside_w, nan=0.0) > 0, out


def emit_mineral_window(lat: float, lon: float, dst_crs: CRS, cache: Path) -> tuple[dict | None, dict]:
    """Mineral-class area fractions in the window, from EMIT L2B granules.

    Granules are merged (most recent first, each filling only cells no earlier
    granule covered) until the window is covered or ``EMIT_MAX_GRANULES`` have
    been read, because a 12 km window often falls near the edge of an EMIT
    swath.
    """
    bbox = sources.window_bbox_latlon("earth", lat, lon, pad_m=0.0)
    granules = earthdata.search_granules(EMIT_SHORT, EMIT_VERSION, bbox=bbox, page_size=20)
    covered = np.zeros((N_PX, N_PX), dtype=bool)
    code = {n: np.full((N_PX, N_PX), np.nan, dtype="float32") for n in (1, 2)}
    used: list[dict] = []
    for g in granules:
        if covered.mean() >= 0.995 or len(used) >= EMIT_MAX_GRANULES:
            break
        url = next((u for u in g["urls"] if u.endswith(".nc") and "MINUNCERT" not in u), None)
        if not url:
            continue
        local = cache / "emit" / url.rsplit("/", 1)[-1]
        earthdata.download(url, local)
        try:
            inside, code_w = _emit_granule_window(local, lat, dst_crs)
        finally:
            local.unlink(missing_ok=True)
        new = inside & ~covered
        if new.mean() < 0.02:
            continue
        for n in code:
            code[n][new] = code_w[n][new]
        covered |= inside
        used.append({"granule_id": g["granule_id"], "start": g["start"], "added_area_fraction": round(float(new.mean()), 4)})
    meta = {"granules_used": used, "n_candidates": len(granules), "swath_coverage": round(float(covered.mean()), 4)}
    if covered.mean() < EMIT_MIN_SWATH_COVERAGE:
        return None, meta
    out: dict[str, object] = {"mineral_swath_coverage_fraction": round(float(covered.mean()), 4)}
    for n in (1, 2):
        identified = covered & np.isfinite(code[n]) & (code[n] >= 0)
        counts = (np.bincount(code[n][identified].astype("int16"), minlength=len(MINERAL_CLASSES))
                  if identified.any() else np.zeros(len(MINERAL_CLASSES), int))
        total = int(counts.sum())
        fractions = {c: round(float(counts[i]) / total, 4) for i, c in enumerate(MINERAL_CLASSES) if counts[i]} if total else {}
        p = np.asarray(list(fractions.values()), dtype="float64")
        shannon = float(-(p * np.log(p)).sum()) if p.size else 0.0
        out[f"mineral_group{n}_identified_area_fraction"] = round(float(identified.sum()) / float(covered.sum()), 4)
        out[f"mineral_group{n}_class_fractions"] = fractions
        out[f"mineral_group{n}_dominant_class"] = max(fractions, key=fractions.get) if fractions else None
        out[f"mineral_group{n}_class_diversity"] = round(abs(shannon), 4)
    return out, meta


# ------------------------------------------------------------------ reducers
def apparent_thermal_inertia(day_lst: np.ndarray, night_lst: np.ndarray, albedo: np.ndarray) -> np.ndarray:
    """Apparent thermal inertia, ATI = (1 - albedo) / (T_day - T_night).

    ATI (units K^-1) is a monotone proxy for thermal inertia under comparable
    insolation; it is **not** thermal inertia and is not in tiu. See
    ``docs/METHODOLOGY.md`` section 9 for what this does and does not support.
    """
    delta = day_lst - night_lst
    with np.errstate(all="ignore"):
        ati = (1.0 - albedo) / delta
    ati[~np.isfinite(ati) | (delta <= 1.0)] = np.nan
    return ati.astype("float32")


def summarise(values: np.ndarray) -> dict[str, float] | None:
    v = values[np.isfinite(values)]
    if v.size < MIN_THERMAL_VALID_FRACTION * values.size:
        return None
    return {
        "median": float(np.median(v)),
        "p10": float(np.percentile(v, 10)),
        "p90": float(np.percentile(v, 90)),
        "valid_fraction": round(float(v.size) / values.size, 4),
    }
