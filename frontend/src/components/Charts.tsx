import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Candidate, FeatureDef } from '../lib/types';
import { indexColor, SERIES_COLORS } from '../lib/format';

// Chart chrome, tuned for the light surface: recessive axes and a hairline
// grid, so the marks carry the ink. Kept in one place rather than per chart.
const INK_FAINT = '#6b6a63';
const GRID = '#eceae3';
const axis = { stroke: INK_FAINT, fontSize: 11 };
const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cdcac0',
  borderRadius: 8,
  fontSize: 12,
  color: '#1b1b19',
  boxShadow: '0 4px 8px rgb(16 24 32 / 0.05), 0 16px 40px -12px rgb(16 24 32 / 0.18)',
};

export interface Series {
  name: string;
  values: number[] | null;
}

/** Slope-frequency distribution (fraction of window area per 1° bin), from computed histograms. */
export function SlopeDistChart({ series, maxDeg = 45 }: { series: Series[]; maxDeg?: number }) {
  const usable = series.filter((s) => s.values && s.values.length);
  if (!usable.length) return <p className="text-sm text-ink-faint">No slope distribution available.</p>;
  const data = Array.from({ length: maxDeg }, (_, i) => {
    const row: Record<string, number> = { deg: i + 0.5 };
    usable.forEach((s) => (row[s.name] = +(100 * (s.values as number[])[i]).toFixed(3)));
    return row;
  });
  return (
    <div className="on-light rounded-lg border border-line/60 p-2 h-56" data-testid="slope-chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="deg" type="number" domain={[0, maxDeg]} tick={axis} stroke={axis.stroke}
            label={{ value: 'Slope (degrees, Horn method, 30 m grid)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={axis} stroke={axis.stroke} unit="%" width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} % of area`} labelFormatter={(l) => `${Math.floor(+l)}–${Math.floor(+l) + 1}°`} />
          <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
          {usable.map((s, i) => (
            <Line key={s.name} dataKey={s.name} dot={false} strokeWidth={i === 0 ? 2.5 : 1.75} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Relative elevation (m above/below the window median) at each 5 % area percentile. */
export function HypsoChart({ series }: { series: Series[] }) {
  const usable = series.filter((s) => s.values && s.values.length === 21);
  if (!usable.length) return <p className="text-sm text-ink-muted">No elevation distribution available.</p>;
  const data = Array.from({ length: 21 }, (_, i) => {
    const row: Record<string, number> = { p: i * 5 };
    usable.forEach((s) => (row[s.name] = (s.values as number[])[i]));
    return row;
  });
  return (
    <div className="on-light rounded-lg border border-line/60 p-2 h-56" data-testid="hypso-chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 18, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="p" type="number" domain={[0, 100]} tick={axis} stroke={axis.stroke}
            label={{ value: 'Percent of window area below this height', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={axis} stroke={axis.stroke} unit=" m" width={60} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)} m vs median`} labelFormatter={(l) => `P${l}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
          {usable.map((s, i) => (
            <Line key={s.name} dataKey={s.name} dot={false} strokeWidth={i === 0 ? 2.5 : 1.75} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Share of the squared distance contributed by each feature (computed by the engine). */
export function ContributionChart({ candidate, defs }: { candidate: Candidate; defs: Record<string, FeatureDef> }) {
  const data = candidate.comparisons.map((c) => ({
    name: defs[c.key]?.label ?? c.key,
    share: +(100 * c.contribution_share).toFixed(1),
    missing: c.status !== 'compared',
  }));
  return (
    <div className="on-light rounded-lg border border-line/60 p-2 h-48" data-testid="contribution-chart">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 14, left: 8 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={axis} stroke={axis.stroke}
            label={{ value: 'Share of D² (higher = feature drives the mismatch)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={150} tick={axis} stroke={axis.stroke} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p) => [`${v}%${p.payload.missing ? ' (missing-data penalty)' : ''}`, 'share']} />
          <Bar dataKey="share" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.missing ? '#be123c' : SERIES_COLORS[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankingChart({ results, onSelect }: { results: Candidate[]; onSelect?: (id: string) => void }) {
  const data = results.slice(0, 15).map((r) => ({ id: r.id, name: `#${r.rank} ${r.name.replace(/ survey cell/, '')}`, s: +r.similarity_index.toFixed(1) }));
  return (
    <div className="on-light rounded-lg border border-line/60 p-2" style={{ height: 28 * data.length + 56 }} data-testid="ranking-chart">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 14, left: 8 }}>
          <XAxis type="number" domain={[0, 100]} tick={axis} stroke={axis.stroke}
            label={{ value: 'Similarity index S = 100·exp(−D)', position: 'insideBottom', offset: -8, fill: '#94a3b8', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={230} tick={{ ...axis, fontSize: 10 }} stroke={axis.stroke} interval={0} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="s" name="Similarity index" isAnimationActive={false} cursor="pointer" onClick={(d: { id: string }) => onSelect?.(d.id)}>
            {data.map((d) => (
              <Cell key={d.id} fill={indexColor(d.s)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
