import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchProvider } from '../lib/SearchContext';
import { candidate, featureDefs, response, target } from '../test/fixtures';
import Explorer from './Explorer';

vi.mock('../components/AnalogMap', () => ({
  default: ({ results }: { results: { id: string }[] | null }) => <div data-testid="map">{results ? `${results.length} markers` : 'pool'}</div>,
}));

const api = vi.hoisted(() => ({
  features: vi.fn(), targets: vi.fn(), earth: vi.fn(), regions: vi.fn(), datasets: vi.fn(), search: vi.fn(), location: vi.fn(), environment: vi.fn(),
}));
vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api }));

function setup() {
  return render(
    <MemoryRouter>
      <SearchProvider>
        <Explorer />
      </SearchProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.features.mockResolvedValue({ features: featureDefs, scales: { slope_median_deg: 2, hypsometric_integral: 0.1, thermal_inertia_percentile: 50 } });
  api.targets.mockResolvedValue([target]);
  api.earth.mockResolvedValue([]);
  api.regions.mockResolvedValue([]);
  api.datasets.mockResolvedValue({ integrated: [], investigated_not_integrated: [] });
  api.environment.mockResolvedValue({
    built_at: 'now', parameters: {}, percentile_reference: null, counts: {},
    earth_windows_ok: 400, earth_windows_with_thermal_feature: 120, earth_windows_with_mineral_classes: 60,
    comparable_features: ['thermal_inertia_percentile'], display_only: 'context only',
  });
  api.location.mockResolvedValue({ ...target, id: 'a', slope_hist: null, rel_elev_quantiles: null, coordinate_source: 'grid', absolute_elevation_median_m: 100 });
});

describe('Explorer', () => {
  it('shows loading then the empty pre-search state', async () => {
    setup();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(await screen.findByText('No search yet')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('pool');
  });

  it('shows an error with retry when the backend is unreachable', async () => {
    api.features.mockRejectedValueOnce(new Error('Cannot reach the analysis server.'));
    setup();
    expect(await screen.findByText('Cannot reach the analysis server.')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText('No search yet')).toBeInTheDocument();
  });

  it('sends the configured weights and renders ranked results', async () => {
    api.search.mockResolvedValue(response([candidate('a', 1, 90), candidate('b', 2, 50)]));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Find Earth analogs' }));
    const list = await screen.findByRole('list', { name: 'Ranked results' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('map')).toHaveTextContent('2 markers');
    const req = api.search.mock.calls[0][0];
    expect(req.target_id).toBe('moon-x');
    expect(req.weights).toEqual({ slope_median_deg: 1, hypsometric_integral: 0.5 });
    expect(req.min_coverage).toBe(1);
    // first candidate opened in the detail panel
    expect(await screen.findByLabelText('Details for Candidate a')).toBeInTheDocument();
  });

  it('removes unchecked features from the request', async () => {
    api.search.mockResolvedValue(response([candidate('a', 1, 90)]));
    setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Hypsometric integral/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Find Earth analogs' }));
    await waitFor(() => expect(api.search).toHaveBeenCalled());
    expect(api.search.mock.calls[0][0].weights).toEqual({ slope_median_deg: 1 });
  });

  it('blocks searching when every feature is deselected', async () => {
    setup();
    for (const name of [/Median slope/, /Hypsometric integral/]) await userEvent.click(await screen.findByRole('checkbox', { name }));
    expect(screen.getByText('Select at least one feature with a weight above zero.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find Earth analogs' })).toBeDisabled();
  });

  it('shows the empty state when nothing can be ranked', async () => {
    api.search.mockResolvedValue(response([], [candidate('x', 0, 10, { rank: null, exclusion_reason: 'data coverage 50% below required 100%' })]));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Find Earth analogs' }));
    expect(await screen.findByText('No ranked candidates')).toBeInTheDocument();
  });

  it('keeps working when a search fails', async () => {
    api.search.mockRejectedValueOnce(new Error('all feature weights are zero'));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Find Earth analogs' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('all feature weights are zero');
    expect(screen.getByRole('button', { name: 'Find Earth analogs' })).toBeEnabled();
  });

  it('reports missing measurements in the detail view', async () => {
    const c = candidate('m', 1, 40, {
      coverage: 0.5, missing_features: ['hypsometric_integral'],
      comparisons: [
        { key: 'slope_median_deg', weight: 1, normalized_weight: 0.5, target_value: 10, candidate_value: 10, scaled_difference: 0, contribution: 0, contribution_share: 0, status: 'compared', note: null },
        { key: 'hypsometric_integral', weight: 1, normalized_weight: 0.5, target_value: 0.5, candidate_value: null, scaled_difference: null, contribution: 4.5, contribution_share: 1, status: 'missing_candidate', note: 'undefined for near-flat terrain' },
      ],
    });
    api.search.mockResolvedValue(response([c]));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Find Earth analogs' }));
    expect(await screen.findByText(/unavailable \(undefined for near-flat terrain\)/)).toBeInTheDocument();
    expect(screen.getByText(/Missing measurements: Hypsometric integral/)).toBeInTheDocument();
  });

  it('starts the partially measured thermal feature switched off and says how far it reaches', async () => {
    setup();
    const label = await screen.findByText(/Thermal inertia percentile/);
    const row = label.closest('div')!.parentElement!;
    expect(within(row).getByRole('checkbox')).not.toBeChecked();
    expect(await screen.findByText(/Measured for 120 of 400 Earth windows/)).toBeInTheDocument();
  });

  it('does not send a zero-weight feature with the default search', async () => {
    api.search.mockResolvedValue(response([candidate('a', 1, 90)]));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /find earth analogs/i }));
    await waitFor(() => expect(api.search).toHaveBeenCalled());
    expect(api.search.mock.calls[0][0].weights).not.toHaveProperty('thermal_inertia_percentile');
  });
});
