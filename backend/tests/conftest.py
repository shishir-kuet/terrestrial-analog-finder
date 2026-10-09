import pytest
from fastapi.testclient import TestClient

from app.main import app, store


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def data():
    return store


ALL_WEIGHTS = {
    "local_relief_m": 1,
    "slope_median_deg": 1,
    "slope_p90_deg": 1,
    "roughness_rms_m": 1,
    "hypsometric_integral": 0.5,
    "slope_distribution": 1,
}
