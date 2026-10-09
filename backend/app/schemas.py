"""Request/response schemas for the HTTP API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

CandidateKind = Literal["earth_named", "earth_survey"]


class SearchRequest(BaseModel):
    target_id: str = Field(..., description="Planetary reference region id (see /api/targets)")
    weights: dict[str, float] = Field(..., description="Non-negative weight per feature key; at least one > 0")
    candidate_kinds: list[CandidateKind] = Field(default_factory=lambda: ["earth_named", "earth_survey"], min_length=1)
    regions: list[str] | None = Field(None, description="Restrict survey cells to these region ids (named sites always kept if selected)")
    min_coverage: float = Field(1.0, gt=0, le=1, description="Minimum weighted data coverage to be ranked")
    missing_penalty: float = Field(3.0, ge=0, le=10, description="Scaled difference assigned to a missing feature")
    limit: int = Field(25, ge=1, le=600)

    @field_validator("weights")
    @classmethod
    def _finite(cls, v: dict[str, float]) -> dict[str, float]:
        import math

        for k, w in v.items():
            if not math.isfinite(w):
                raise ValueError(f"weight for {k} must be finite")
        return v


class FeatureComparisonOut(BaseModel):
    key: str
    weight: float
    normalized_weight: float
    target_value: float | None
    candidate_value: float | None
    scaled_difference: float | None
    contribution: float
    contribution_share: float
    status: str
    note: str | None = None


class CandidateOut(BaseModel):
    rank: int | None
    id: str
    name: str
    kind: str
    lat: float
    lon: float
    coordinate_status: str
    distance: float
    similarity_index: float
    coverage: float
    missing_features: list[str]
    comparisons: list[FeatureComparisonOut]
    dataset_id: str
    hillshade: str | None
    exclusion_reason: str | None = None


class SearchResponse(BaseModel):
    target: dict
    config: dict
    results: list[CandidateOut]
    excluded: list[CandidateOut]
    n_candidates_considered: int
    warnings: list[str]
    interpretation: str
