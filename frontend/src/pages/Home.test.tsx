import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchProvider } from '../lib/SearchContext';
import { featureDefs, target } from '../test/fixtures';
import Home from './Home';

const nav = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => nav,
}));

const api = vi.hoisted(() => ({
  health: vi.fn(), targets: vi.fn(), regions: vi.fn(), datasets: vi.fn(), features: vi.fn(), environment: vi.fn(),
}));
vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api }));

const marsTarget = { ...target, id: 'mars-y', name: 'Test crater', body: 'mars' as const };

function setup() {
  return render(
    <MemoryRouter>
      <SearchProvider>
        <Home />
      </SearchProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  nav.mockReset();
  Object.values(api).forEach((f) => f.mockReset());
  api.health.mockResolvedValue({ status: 'ok', locations: 570, built_at: '2026-10-09T18:19:51+00:00' });
  api.targets.mockResolvedValue([target, marsTarget]);
  api.regions.mockResolvedValue([{ id: 'r1', name: 'R1', lat: [0, 1], lon: [0, 1], step: 1 }]);
  api.datasets.mockResolvedValue({
    integrated: [
      { id: 'ds-moon', name: 'LOLA DTMs', body: 'moon', source_url: 'https://example.invalid/lola', spatial_resolution: '5 m' },
      { id: 'ds-earth', name: 'Copernicus DEM', body: 'earth', source_url: 'https://example.invalid/cop', spatial_resolution: '30 m' },
    ],
    investigated_not_integrated: [],
  });
  api.features.mockResolvedValue({ features: featureDefs, scales: {} });
  api.environment.mockResolvedValue({
    built_at: 'now', parameters: {}, percentile_reference: null, counts: {},
    earth_windows_ok: 469, earth_windows_with_thermal_feature: 120, earth_windows_with_mineral_classes: 60,
    comparable_features: ['thermal_inertia_percentile'], display_only: 'context only',
  });
});

describe('Home', () => {
  it('reports the live server state once health resolves', async () => {
    setup();
    expect(screen.getByText(/Contacting analysis server/)).toBeInTheDocument();
    expect(await screen.findByText(/Analysis server online · 570 locations/)).toBeInTheDocument();
  });

  it('surfaces a health failure instead of silently showing nothing', async () => {
    api.health.mockRejectedValue(new Error('backend down'));
    setup();
    expect(await screen.findByText(/Analysis server unavailable — backend down/)).toBeInTheDocument();
  });

  it('derives the headline counts from the live API rather than hard-coded numbers', async () => {
    setup();
    // 570 locations - 2 planetary targets = 568 Earth candidates.
    expect(await screen.findByText('568')).toBeInTheDocument();
    expect(screen.getByText(/469 with a complete terrain window/)).toBeInTheDocument();
    expect(screen.getByText('1 lunar · 1 Martian')).toBeInTheDocument();
  });

  it('spotlights a reference site with its hillshade and measured terrain', async () => {
    setup();
    const img = await screen.findByAltText(/Hillshade of the 12 km measurement window at Test ridge/);
    expect(img).toHaveAttribute('src', expect.stringContaining('/api/hillshade/moon-x.png'));
    expect(screen.getByText('10.0°')).toBeInTheDocument(); // median slope, formatted from the feature def
  });

  it('sends the spotlighted target through to the Explorer', async () => {
    setup();
    await screen.findByText('Test ridge');
    await userEvent.click(screen.getByRole('tab', { name: 'Test crater' }));
    await waitFor(() => expect(screen.getByText('Test crater')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Find Earth analogs/ }));
    expect(nav).toHaveBeenCalledWith('/explore');
  });

  it('lists only the scored features as comparison chips', async () => {
    setup();
    const chips = within(await screen.findByRole('list', { name: 'Features used in scoring' }));
    expect(chips.getByText('Median slope')).toBeInTheDocument();
    expect(chips.getByText('Hypsometric integral')).toBeInTheDocument();
    // default_weight 0: context only, never presented as something being compared.
    expect(chips.queryByText(/Thermal inertia percentile/)).not.toBeInTheDocument();
  });

  it('keeps the scientific disclaimer on the landing page', async () => {
    setup();
    expect(await screen.findByText('Scientific disclaimer')).toBeInTheDocument();
  });
});
