"""Data-acquisition layer: read a harmonised elevation window from each
supported source product.

Every reader returns elevation in metres on a local azimuthal-equidistant
grid centred on the requested point (``WINDOW_SIZE_M`` square, ``GRID_RES_M``
spacing). Missing source cells stay ``NaN``; nothing is filled or
extrapolated.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
import rasterio.errors
from rasterio.crs import CRS
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import from_bounds

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "4")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")

WINDOW_SIZE_M = 12_000.0
GRID_RES_M = 30.0
N_PX = int(WINDOW_SIZE_M / GRID_RES_M)

BODY_RADIUS_M = {"moon": 1_737_400.0, "mars": 3_396_190.0}

COPERNICUS_BASE = "https://copernicus-dem-30m.s3.amazonaws.com"
ASTROGEO_BASE = "https://astrogeo-ard.s3-us-west-2.amazonaws.com"
TILELIST = Path(__file__).resolve().parents[2] / "data" / "sources" / "copernicus_glo30_tilelist.txt"


@dataclass
class Window:
    elevation: np.ndarray  # float32 metres, NaN = missing
    res_m: float
    crs_proj4: str
    source_urls: list[str]
    source_res_m: float
    resampling: str


def local_crs(body: str, lat: float, lon: float) -> CRS:
    """Azimuthal-equidistant CRS centred on (lat, lon) for the given body."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"invalid coordinates lat={lat}, lon={lon}")
    if body == "earth":
        figure = "+ellps=WGS84"
    elif body in BODY_RADIUS_M:
        figure = f"+R={BODY_RADIUS_M[body]:.0f}"
    else:
        raise ValueError(f"unknown body {body!r}")
    return CRS.from_proj4(f"+proj=aeqd +lat_0={lat:.6f} +lon_0={lon:.6f} +x_0=0 +y_0=0 {figure} +units=m +no_defs")


def _dst_grid():
    half = WINDOW_SIZE_M / 2
    return from_origin(-half, half, GRID_RES_M, GRID_RES_M), (N_PX, N_PX)


def _resampling_for(src_res_m: float) -> Resampling:
    # Average when the source is finer than the target grid (true
    # aggregation); bilinear when resolutions are comparable, so we never
    # pretend that resampling adds detail.
    return Resampling.average if src_res_m < 0.75 * GRID_RES_M else Resampling.bilinear


def _warp_into(src, dst: np.ndarray, dst_crs: CRS, src_res_m: float, mask_src=None) -> None:
    """Warp the part of ``src`` covering the destination grid into ``dst``,
    only filling cells that are still NaN. ``mask_src`` (same grid as
    ``src``) marks cells to discard where its value is > 0."""
    dst_transform, shape = _dst_grid()
    half = WINDOW_SIZE_M / 2 + 4 * max(src_res_m, GRID_RES_M)
    b = transform_bounds(dst_crs, src.crs, -half, -half, half, half, densify_pts=41)
    win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
    try:
        win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
    except rasterio.errors.WindowError:
        return  # tile does not overlap the window
    if win.width < 1 or win.height < 1:
        return
    data = src.read(1, window=win, masked=False).astype("float32")
    nod = src.nodata
    if nod is not None and not (isinstance(nod, float) and math.isnan(nod)):
        data[data == nod] = np.nan
    if mask_src is not None:
        data[mask_src.read(1, window=win) > 0] = np.nan
    tmp = np.full(shape, np.nan, dtype="float32")
    reproject(
        data,
        tmp,
        src_transform=src.window_transform(win),
        src_crs=src.crs,
        src_nodata=np.nan,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        dst_nodata=np.nan,
        resampling=_resampling_for(src_res_m),
    )
    fill = np.isnan(dst) & np.isfinite(tmp)
    dst[fill] = tmp[fill]


@lru_cache(maxsize=1)
def copernicus_tiles() -> frozenset[str]:
    return frozenset(TILELIST.read_text().split())


def copernicus_tile_name(lat_floor: int, lon_floor: int) -> str:
    ns = "N" if lat_floor >= 0 else "S"
    ew = "E" if lon_floor >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"


def read_copernicus_window(lat: float, lon: float) -> Window:
    """Copernicus DEM GLO-30 (ESA) window. Missing tiles (oceans, unreleased
    tiles) stay NaN; the dataset README suggests assuming zero over ocean,
    which we deliberately do not do. Cells flagged in the tile's Water Body
    Mask (WBM: 1 ocean, 2 lake, 3 river) are also set to NaN because their
    heights are flattened/edited rather than measured terrain."""
    dst_crs = local_crs("earth", lat, lon)
    half = WINDOW_SIZE_M / 2 + 200
    w, s, e, n = transform_bounds(dst_crs, "EPSG:4326", -half, -half, half, half, densify_pts=41)
    out = np.full((N_PX, N_PX), np.nan, dtype="float32")
    urls = []
    available = copernicus_tiles()
    for la in range(math.floor(s), math.floor(n) + 1):
        for lo in range(math.floor(w), math.floor(e) + 1):
            name = copernicus_tile_name(la, lo)
            if name not in available:
                continue
            url = f"{COPERNICUS_BASE}/{name}/{name}.tif"
            wbm = f"{COPERNICUS_BASE}/{name}/AUXFILES/{name.replace('_DEM', '_WBM')}.tif"
            urls += [url, wbm]
            with rasterio.open(url) as src, rasterio.open(wbm) as msk:
                if msk.transform != src.transform or msk.shape != src.shape:
                    raise ValueError(f"water-body mask grid does not match DEM for {name}")
                _warp_into(src, out, dst_crs, src_res_m=30.0, mask_src=msk)
    return Window(out, GRID_RES_M, dst_crs.to_proj4(), urls, 30.0, _resampling_for(30.0).name)


def read_astrogeo_window(body: str, url: str, lat: float, lon: float, src_res_m: float) -> Window:
    """Window from a USGS Astrogeology analysis-ready COG (LOLA or CTX DTM)."""
    dst_crs = local_crs(body, lat, lon)
    out = np.full((N_PX, N_PX), np.nan, dtype="float32")
    with rasterio.open(url) as src:
        _warp_into(src, out, dst_crs, src_res_m=src_res_m)
    return Window(out, GRID_RES_M, dst_crs.to_proj4(), [url], src_res_m, _resampling_for(src_res_m).name)
