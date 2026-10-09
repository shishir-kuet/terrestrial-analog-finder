import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EnvironmentPanel from './Environment';

describe('EnvironmentPanel', () => {
  it('renders measured values with their units', () => {
    render(
      <EnvironmentPanel
        title="Candidate: Death Valley"
        env={{
          status: 'ok',
          attributes: {
            lst_day_median_k: 327.46,
            lst_night_median_k: 307.6,
            diurnal_lst_range_k: 19.83,
            albedo_shortwave_median: 0.2394,
            apparent_thermal_inertia_median: 0.0401,
            thermal_valid_fraction: 0.994,
            mineral_group2_dominant_class: 'illite_muscovite',
            mineral_group2_class_fractions: { illite_muscovite: 0.2855, smectite: 0.2532 },
          },
          provenance: {},
        }}
      />,
    );
    expect(screen.getByText(/Candidate: Death Valley/)).toBeInTheDocument();
    expect(screen.getByText('327.5 K')).toBeInTheDocument();
    expect(screen.getByText('99.4 %')).toBeInTheDocument();
    expect(screen.getAllByText(/illite \/ muscovite/).length).toBeGreaterThan(0);
    expect(screen.getByText('29%')).toBeInTheDocument();
  });

  it('explains an absent measurement instead of showing nothing', () => {
    render(
      <EnvironmentPanel
        title="Reference: Shackleton rim (Moon)"
        env={{ status: 'ok', attributes: {}, provenance: {} }}
        missingReason="no thermal inertia product for the lunar south pole exists in the archives reachable here"
      />,
    );
    expect(screen.getByText(/No thermal or mineral measurement/)).toBeInTheDocument();
    expect(screen.getByText(/lunar south pole/)).toBeInTheDocument();
  });

  it('handles a location the environmental build never reached', () => {
    render(<EnvironmentPanel title="Candidate: X" env={null} missingReason="not covered by the build" />);
    expect(screen.getByText(/not covered by the build/)).toBeInTheDocument();
  });
});
