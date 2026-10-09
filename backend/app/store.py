"""Read-only access to the processed dataset and catalog files."""

from __future__ import annotations

import json
import os
from functools import cached_property
from pathlib import Path

from app.registry import ENVIRONMENTAL_FEATURES
from app.similarity import compute_scales

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


class DataUnavailable(RuntimeError):
    pass


class Store:
    def __init__(self, data_dir: Path | None = None):
        self.data_dir = Path(data_dir or os.environ.get("TAF_DATA_DIR") or DEFAULT_DATA_DIR)
        self.processed = self.data_dir / "processed"
        self.sources = self.data_dir / "sources"

    def _read(self, path: Path) -> dict:
        if not path.exists():
            raise DataUnavailable(f"{path.relative_to(self.data_dir)} is missing; run the data pipeline (see README)")
        return json.loads(path.read_text())

    @cached_property
    def environment(self) -> dict:
        """The environmental build, or an empty one when it has not been run.

        Keeping it separate means the terrain-only ranking is identical with or
        without this layer, and a partial environmental build is usable.
        """
        p = self.processed / "environment.json"
        return json.loads(p.read_text()) if p.exists() else {"locations": {}, "parameters": {}, "counts": {}}

    @cached_property
    def locations(self) -> dict[str, dict]:
        recs = self._read(self.processed / "locations.json")["locations"]
        env = self.environment.get("locations", {})
        out = {}
        for r in recs:
            if not (-90 <= r["lat"] <= 90 and -180 <= r["lon"] <= 180):
                raise DataUnavailable(f"invalid coordinates for {r['id']}")
            e = env.get(r["id"])
            if e:
                for key in ENVIRONMENTAL_FEATURES:
                    r["features"][key] = e["values"].get(key)
                    if e["values"].get(key) is None:
                        r.setdefault("missing_reasons", {})[key] = e["missing_reasons"].get(
                            key, "not measured in this data build")
                r["environment"] = {
                    "status": e.get("status"),
                    "error": e.get("error"),
                    "attributes": e.get("attributes", {}),
                    "provenance": e.get("provenance", {}),
                }
            else:
                for key in ENVIRONMENTAL_FEATURES:
                    r["features"][key] = None
                    r.setdefault("missing_reasons", {})[key] = (
                        "this location was not covered by the environmental data build")
                r["environment"] = None
            out[r["id"]] = r
        return out

    @cached_property
    def manifest(self) -> dict:
        return self._read(self.processed / "manifest.json")

    @cached_property
    def datasets(self) -> dict:
        return self._read(self.sources / "datasets.json")

    @cached_property
    def sensitivity(self) -> dict | None:
        p = self.processed / "sensitivity.json"
        return json.loads(p.read_text()) if p.exists() else None

    @property
    def targets(self) -> list[dict]:
        return [r for r in self.locations.values() if r["kind"] == "target"]

    @property
    def earth(self) -> list[dict]:
        return [r for r in self.locations.values() if r["body"] == "earth"]

    @cached_property
    def reference_pool(self) -> list[dict]:
        """Earth locations with complete windows: the fixed pool that defines
        the robust feature scales (independent of any request)."""
        return [r for r in self.earth if r["status"] == "ok"]

    @cached_property
    def scales(self) -> dict[str, float]:
        return compute_scales(self.reference_pool)

    def dataset(self, dataset_id: str) -> dict | None:
        return next((d for d in self.datasets["integrated"] if d["id"] == dataset_id), None)
