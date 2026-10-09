export type Body = 'moon' | 'mars' | 'earth';
export type Kind = 'target' | 'earth_named' | 'earth_survey';

export interface FeatureDef {
  key: string;
  label: string;
  unit: string;
  kind: 'scalar' | 'distribution';
  transform: 'identity' | 'log10';
  log_offset: number;
  default_weight: number;
  meaning: string;
  method: string;
  limitations: string;
}

export interface LocationSummary {
  id: string;
  name: string;
  kind: Kind;
  body: Body;
  lat: number;
  lon: number;
  coordinate_status: string;
  status: 'ok' | 'insufficient_data' | 'error';
  valid_fraction: number | null;
  features: Record<string, number | null>;
  missing_reasons: Record<string, string>;
  dataset_id: string;
  hillshade: string | null;
  region?: string | null;
  analog_context?: string | null;
  environment?: LocationEnvironment | null;
}

/** Thermal and mineral measurements attached by the environmental data build. */
export interface LocationEnvironment {
  status: string | null;
  error?: string | null;
  attributes: Record<string, number | string | Record<string, number> | null>;
  provenance: Record<string, unknown>;
}

export interface EnvironmentInfo {
  built_at: string | null;
  parameters: Record<string, unknown>;
  percentile_reference: Record<string, unknown> | null;
  counts: Record<string, Record<string, number>>;
  earth_windows_ok: number;
  earth_windows_with_thermal_feature: number;
  earth_windows_with_mineral_classes: number;
  comparable_features: string[];
  display_only: string;
}

export interface SourceItem {
  stac_url: string;
  title: string | null;
  license: string | null;
  doi: string | null;
  citation: string | null;
  start: string | null;
  end: string | null;
  gsd_m: number | null;
}

export interface Target extends LocationSummary {
  source_item?: SourceItem | null;
  selection_note?: string | null;
}

export interface LocationDetail extends LocationSummary {
  slope_hist: number[] | null;
  rel_elev_quantiles: number[] | null;
  absolute_elevation_median_m: number | null;
  coordinate_source: string;
  processing?: Record<string, unknown>;
  source_item?: SourceItem | null;
  selection_note?: string | null;
  error?: string;
}

export interface FeatureComparison {
  key: string;
  weight: number;
  normalized_weight: number;
  target_value: number | null;
  candidate_value: number | null;
  scaled_difference: number | null;
  contribution: number;
  contribution_share: number;
  status: 'compared' | 'missing_candidate';
  note: string | null;
}

export interface Candidate {
  rank: number | null;
  id: string;
  name: string;
  kind: Kind;
  lat: number;
  lon: number;
  coordinate_status: string;
  distance: number;
  similarity_index: number;
  coverage: number;
  missing_features: string[];
  comparisons: FeatureComparison[];
  dataset_id: string;
  hillshade: string | null;
  exclusion_reason: string | null;
}

export interface SearchRequest {
  target_id: string;
  weights: Record<string, number>;
  candidate_kinds: Exclude<Kind, 'target'>[];
  regions?: string[] | null;
  min_coverage: number;
  missing_penalty: number;
  limit: number;
}

export interface SearchResponse {
  target: LocationSummary & { slope_hist: number[] | null; rel_elev_quantiles: number[] | null };
  config: {
    weights: Record<string, number>;
    normalized_weights: Record<string, number>;
    scales: Record<string, number>;
    transforms: Record<string, string>;
    min_coverage: number;
    missing_penalty: number;
    reference_pool_size: number;
    candidate_coverage?: Record<string, number>;
    data_built_at: string;
  };
  results: Candidate[];
  excluded: Candidate[];
  n_candidates_considered: number;
  warnings: string[];
  interpretation: string;
}

export interface Dataset {
  id: string;
  name: string;
  body: Body;
  provider: string;
  source_url: string;
  doi: string | null;
  citation: string;
  variables: string[];
  units: string;
  spatial_resolution: string;
  spatial_coverage: string;
  temporal_coverage: string;
  crs: string;
  license: string;
  authentication: string;
  access_method: string;
  preprocessing: string;
  limitations: string;
}

export interface DatasetCatalog {
  integrated: Dataset[];
  investigated_not_integrated: { name: string; url: string; status: string; would_provide: string }[];
}

export interface SurveyRegion {
  id: string;
  name: string;
  lat: [number, number];
  lon: [number, number];
  step: number;
}
