import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HypsoChart, SlopeDistChart } from './Charts';

describe('charts', () => {
  it('shows an explicit message instead of fabricating data', () => {
    render(<SlopeDistChart series={[{ name: 'x', values: null }]} />);
    expect(screen.getByText('No slope distribution available.')).toBeInTheDocument();
    render(<HypsoChart series={[{ name: 'x', values: [1, 2, 3] }]} />);
    expect(screen.getByText('No elevation distribution available.')).toBeInTheDocument();
  });
  it('renders when computed data is supplied', () => {
    render(<SlopeDistChart series={[{ name: 'ref', values: Array(90).fill(1 / 90) }]} />);
    expect(screen.getByTestId('slope-chart')).toBeInTheDocument();
  });
});
