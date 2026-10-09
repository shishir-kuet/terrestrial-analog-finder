"""Access layer for NASA Earthdata-hosted products (CMR search + file reads).

Only two mechanisms are used, both documented by the providers:

* **CMR** (https://cmr.earthdata.nasa.gov/search) for granule discovery.
* **HTTPS reads of the LP DAAC distribution endpoint**
  (https://data.lpdaac.earthdatacloud.nasa.gov). Cloud-Optimized GeoTIFFs are
  read with GDAL range requests (``/vsicurl``); netCDF/HDF5 granules, which do
  not support partial reads here, are downloaded to the cache and deleted once
  their window has been extracted.

Authentication: LP DAAC requires a NASA Earthdata login. In this environment the
egress proxy injects the Earthdata bearer token for the distribution host, so no
credentials appear in this repository. Outside it, set ``EARTHDATA_TOKEN`` (or
``EARTHDATA_USERNAME``/``EARTHDATA_PASSWORD`` and let ``~/.netrc`` handle the
redirect) as described in ``.env.example``.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
LPDAAC_HOST = "data.lpdaac.earthdatacloud.nasa.gov"
CA_BUNDLE = os.environ.get("TAF_CA_BUNDLE") or "/root/.ccr/ca-bundle.crt"

_RETRIES = 4
_BACKOFF = 2.0


def configure_gdal() -> None:
    """Point GDAL's bundled libcurl at the CA bundle this environment trusts.

    The rasterio wheel sets ``GDAL_CURL_CA_BUNDLE`` to its own vendored certifi
    bundle, which does not include the egress proxy's CA, so HTTPS reads of the
    LP DAAC host fail certificate verification while plain S3 reads succeed.
    Nothing here weakens verification; it only selects the correct bundle.
    """
    if Path(CA_BUNDLE).exists():
        os.environ["GDAL_CURL_CA_BUNDLE"] = CA_BUNDLE
        os.environ["GDAL_HTTP_CAINFO"] = CA_BUNDLE


def _auth_header() -> dict[str, str]:
    token = os.environ.get("EARTHDATA_TOKEN")
    return {"Authorization": f"Bearer {token}"} if token else {}


def http_json(url: str, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json", **_auth_header()})
    last: Exception | None = None
    for attempt in range(_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            time.sleep(_BACKOFF * 2**attempt)
    raise RuntimeError(f"CMR/HTTP request failed after {_RETRIES} attempts: {url} ({last})")


def download(url: str, dest: Path, timeout: int = 900) -> Path:
    """Download ``url`` to ``dest`` (atomic, retried). Existing files are kept."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers=_auth_header())
    last: Exception | None = None
    for attempt in range(_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r, tmp.open("wb") as fh:
                while chunk := r.read(1 << 20):
                    fh.write(chunk)
            tmp.replace(dest)
            return dest
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            tmp.unlink(missing_ok=True)
            time.sleep(_BACKOFF * 2**attempt)
    raise RuntimeError(f"download failed after {_RETRIES} attempts: {url} ({last})")


def search_granules(
    short_name: str,
    version: str | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    temporal: tuple[str, str] | None = None,
    day_night: str | None = None,
    page_size: int = 50,
) -> list[dict]:
    """Search CMR and return simplified granule records.

    ``bbox`` is (west, south, east, north) in degrees. ``day_night`` is "day" or
    "night" and maps to CMR's ``day_night_flag``. Each record carries the
    granule id, the acquisition time range and the HTTPS asset URLs.
    """
    params: list[tuple[str, str]] = [("short_name", short_name), ("page_size", str(page_size))]
    if version:
        params.append(("version", version))
    if bbox:
        params.append(("bounding_box", ",".join(f"{v:.6f}" for v in bbox)))
    if temporal:
        params.append(("temporal", f"{temporal[0]},{temporal[1]}"))
    if day_night:
        params.append(("day_night_flag", day_night))
    doc = http_json(f"{CMR_GRANULES}?{urllib.parse.urlencode(params)}")
    out = []
    for item in doc.get("items", []):
        umm = item["umm"]
        rng = (umm.get("TemporalExtent") or {}).get("RangeDateTime") or {}
        urls = [
            r["URL"]
            for r in umm.get("RelatedUrls", [])
            if r.get("Type") == "GET DATA" and r.get("URL", "").startswith("https://")
        ]
        out.append(
            {
                "granule_id": umm.get("GranuleUR"),
                "start": rng.get("BeginningDateTime"),
                "end": rng.get("EndingDateTime"),
                "day_night": umm.get("DataGranule", {}).get("DayNightFlag"),
                "urls": urls,
                "concept_id": item.get("meta", {}).get("concept-id"),
            }
        )
    return out


def asset(granule: dict, suffix: str) -> str | None:
    """The granule asset URL ending in ``suffix`` (e.g. '_LST.tif')."""
    return next((u for u in granule["urls"] if u.endswith(suffix)), None)
