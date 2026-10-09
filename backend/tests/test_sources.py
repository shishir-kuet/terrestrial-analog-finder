"""Tests for the acquisition helpers that do not need network access."""

import pytest
from pyproj import CRS, Transformer

from pipeline import sources


def test_local_crs_rejects_invalid_coordinates():
    for lat, lon in [(91, 0), (-90.1, 0), (0, 181), (0, -180.5)]:
        with pytest.raises(ValueError):
            sources.local_crs("earth", lat, lon)
    with pytest.raises(ValueError):
        sources.local_crs("venus", 0, 0)


@pytest.mark.parametrize("body,radius", [("moon", 1737400), ("mars", 3396190)])
def test_local_crs_uses_body_sphere_and_is_distance_preserving(body, radius):
    crs = CRS.from_wkt(sources.local_crs(body, -85.0, 30.0).to_wkt())
    assert crs.ellipsoid.semi_major_metre == pytest.approx(radius)
    t = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
    lon, lat = t.transform(0.0, 6000.0)  # 6 km due "north" of centre
    import math
    arc = math.radians(lat - (-85.0)) * radius
    assert arc == pytest.approx(6000.0, rel=1e-4)
    assert lon == pytest.approx(30.0, abs=1e-6)


def test_earth_crs_is_wgs84():
    crs = CRS.from_wkt(sources.local_crs("earth", 35, -111).to_wkt())
    assert crs.ellipsoid.semi_major_metre == pytest.approx(6378137.0)


def test_copernicus_tile_names():
    assert sources.copernicus_tile_name(35, -112) == "Copernicus_DSM_COG_10_N35_00_W112_00_DEM"
    assert sources.copernicus_tile_name(-25, 0) == "Copernicus_DSM_COG_10_S25_00_E000_00_DEM"
    tiles = sources.copernicus_tiles()
    assert sources.copernicus_tile_name(35, -112) in tiles
    assert sources.copernicus_tile_name(0, -150) not in tiles  # open Pacific: no tile


def test_resampling_choice_never_upsamples_with_average():
    assert sources._resampling_for(5.0).name == "average"
    assert sources._resampling_for(20.0).name == "average"
    assert sources._resampling_for(30.0).name == "bilinear"
