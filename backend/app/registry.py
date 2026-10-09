"""Feature registry: the single source of truth for what each comparable
feature means, how it is computed and how it is transformed before scaling.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from app import features as fx


@dataclass(frozen=True)
class FeatureDef:
    key: str
    label: str
    unit: str
    kind: str  # "scalar" | "distribution"
    transform: str  # "identity" | "log10"
    log_offset: float  # added before log10 so that zero values stay finite
    default_weight: float
    meaning: str
    method: str
    limitations: str

    def to_dict(self) -> dict:
        return asdict(self)



FEATURES: dict[str, FeatureDef] = {
    f.key: f
    for f in [
        FeatureDef(
            "local_relief_m",
            "Local relief",
            "m",
            "scalar",
            "log10",
            1.0,
            1.0,
            "Robust elevation range inside the 12 km x 12 km window.",
            f"P{fx.RELIEF_HIGH_Q:g} minus P{fx.RELIEF_LOW_Q:g} of valid elevations on the 30 m grid. "
            "Uses only height differences, so it is independent of the vertical datum.",
            "Depends strongly on window size; includes regional tilt; Copernicus DEM is a surface "
            "model (vegetation and buildings add relief on Earth).",
        ),
        FeatureDef(
            "slope_median_deg",
            "Median slope",
            "degrees",
            "scalar",
            "identity",
            0.0,
            1.0,
            "Typical steepness of the terrain.",
            "Horn (1981) 3x3 finite-difference slope on the 30 m grid (60 m effective baseline); "
            "median over cells whose full 3x3 neighbourhood is valid.",
            "Slope is scale-dependent: values at 30 m differ from values at 5 m or 500 m. "
            "Interpolation smooths the steepest slopes.",
        ),
        FeatureDef(
            "slope_p90_deg",
            "90th-percentile slope",
            "degrees",
            "scalar",
            "identity",
            0.0,
            1.0,
            "Steepness of the steepest 10 % of the window (scarps, crater walls).",
            "90th percentile of the Horn slope distribution described above.",
            "Same scale dependence as median slope; sensitive to DEM artefacts on Earth (e.g. forest edges).",
        ),
        FeatureDef(
            "roughness_rms_m",
            "Short-baseline roughness",
            "m",
            "scalar",
            "log10",
            0.1,
            1.0,
            "Small-scale bumpiness after removing landforms larger than ~150 m.",
            f"RMS of (elevation - {fx.ROUGHNESS_KERNEL_PX}x{fx.ROUGHNESS_KERNEL_PX} moving mean) on the 30 m grid "
            f"({fx.ROUGHNESS_KERNEL_PX * 30} m window).",
            "Near the noise floor of the planetary DEMs (LOLA track interpolation, CTX stereo noise) and "
            "affected by vegetation/buildings in the Copernicus surface model.",
        ),
        FeatureDef(
            "hypsometric_integral",
            "Hypsometric integral",
            "dimensionless (0-1)",
            "scalar",
            "identity",
            0.0,
            0.5,
            "Where the average surface sits within the local elevation range "
            "(low = mostly lowland with isolated highs, high = plateau cut by depressions).",
            "(mean - P2) / (P98 - P2) using elevations clipped to [P2, P98]. Undefined (reported "
            f"missing) when relief < {fx.MIN_RELIEF_FOR_HI_M:g} m.",
            "Shape descriptor only; sensitive to where the window boundary falls.",
        ),
        FeatureDef(
            "slope_distribution",
            "Slope distribution (Wasserstein-1)",
            "degrees",
            "distribution",
            "identity",
            0.0,
            1.0,
            "Whole slope-frequency distribution rather than a summary statistic.",
            "1-D Wasserstein (earth mover's) distance between 1-degree slope histograms: "
            "sum over bins of |CDF_candidate - CDF_target| x 1 degree. Scaled by the same IQR as median slope.",
            "Treats the window as a bag of slopes (ignores spatial arrangement).",
        ),
        FeatureDef(
            "thermal_inertia_percentile",
            "Thermal inertia percentile (within body)",
            "percentile (0-100)",
            "scalar",
            "identity",
            0.0,
            0.0,
            "How this window's thermophysical character ranks against its own body: low values are "
            "dust- or fines-dominated surfaces that lose heat quickly, high values are rock, duricrust "
            "or exposed bedrock.",
            "Earth: apparent thermal inertia ATI = (1 - albedo) / (T_day - T_night) from ECOSTRESS "
            "ECO_L2T_LSTE v002 land-surface temperature medians and VNP43MA3 shortwave albedo, "
            "expressed as a percentile of the Earth windows in this build. Mars: median MGS TES "
            "nightside thermal inertia (tiu) over the window, expressed as a percentile of the whole "
            "global TES map. Moon: not available (reported missing with the reason).",
            "Earth ATI and Mars thermal inertia are different quantities in different units; only their "
            "within-body ranks are compared, which assumes the two distributions correspond - they are "
            "not calibrated against each other. The Earth percentile is relative to this app's "
            "deliberately arid/volcanic/polar pool, not to Earth as a whole. The TES map is ~3 km per "
            "pixel, so a 12 km window holds only about 16 source pixels. Default weight is 0, so this "
            "feature changes nothing until it is switched on.",
        ),
    ]
}

SCALE_SOURCE = {"slope_distribution": "slope_median_deg"}

# Features whose measurements come from the environmental build
# (``data/processed/environment.json``) rather than the terrain build.
ENVIRONMENTAL_FEATURES = ("thermal_inertia_percentile",)
