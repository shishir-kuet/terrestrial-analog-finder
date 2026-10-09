import type { Candidate, FeatureDef, SearchResponse, Target } from '../lib/types';

export const featureDefs: FeatureDef[] = [
  { key: 'slope_median_deg', label: 'Median slope', unit: 'degrees', kind: 'scalar', transform: 'identity', log_offset: 0, default_weight: 1, meaning: 'm', method: 'm', limitations: 'l' },
  { key: 'hypsometric_integral', label: 'Hypsometric integral', unit: 'dimensionless (0-1)', kind: 'scalar', transform: 'identity', log_offset: 0, default_weight: 0.5, meaning: 'm', method: 'm', limitations: 'l' },
];

export const target: Target = {
  id: 'moon-x', name: 'Test ridge', kind: 'target', body: 'moon', lat: -89.4, lon: -137.4,
  coordinate_status: 'derived_from_source_metadata', status: 'ok', valid_fraction: 1,
  features: { slope_median_deg: 10, hypsometric_integral: 0.5 }, missing_reasons: {},
  dataset_id: 'ds-moon', hillshade: 'hillshade/moon-x.png',
  source_item: { stac_url: 'u', title: 'Test DTM', license: 'CC0-1.0', doi: null, citation: null, start: null, end: null, gsd_m: 5 },
};

export function candidate(id: string, rank: number, s: number, extra: Partial<Candidate> = {}): Candidate {
  return {
    rank, id, name: `Candidate ${id}`, kind: 'earth_survey', lat: 10 + rank, lon: 20, coordinate_status: 'algorithmic_grid',
    distance: -Math.log(s / 100), similarity_index: s, coverage: 1, missing_features: [], dataset_id: 'ds-earth', hillshade: null,
    exclusion_reason: null,
    comparisons: [
      { key: 'slope_median_deg', weight: 1, normalized_weight: 1, target_value: 10, candidate_value: 11, scaled_difference: 0.5, contribution: 0.25, contribution_share: 1, status: 'compared', note: null },
    ],
    ...extra,
  };
}

export function response(results: Candidate[], excluded: Candidate[] = []): SearchResponse {
  return {
    target: { ...target, slope_hist: Array(90).fill(0).map((_, i) => (i === 10 ? 1 : 0)), rel_elev_quantiles: Array(21).fill(0).map((_, i) => i * 10 - 100) },
    config: { weights: { slope_median_deg: 1 }, normalized_weights: { slope_median_deg: 1 }, scales: { slope_median_deg: 2 }, transforms: { slope_median_deg: 'identity' }, min_coverage: 1, missing_penalty: 3, reference_pool_size: 100, data_built_at: 'now' },
    results, excluded, n_candidates_considered: results.length + excluded.length, warnings: [],
    interpretation: 'S = 100 exp(-D); not a probability.',
  };
}
