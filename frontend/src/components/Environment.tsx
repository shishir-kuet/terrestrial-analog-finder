import type { LocationEnvironment } from '../lib/types';

/** Labels, units and rounding for the measurements of the environmental build.
 *  Keys absent from a location are simply not rendered: nothing is defaulted. */
const ROWS: { key: string; label: string; unit?: string; digits?: number; percent?: boolean }[] = [
  { key: 'lst_day_median_k', label: 'Daytime land-surface temperature (median)', unit: 'K', digits: 1 },
  { key: 'lst_night_median_k', label: 'Night-time land-surface temperature (median)', unit: 'K', digits: 1 },
  { key: 'diurnal_lst_range_k', label: 'Day − night difference', unit: 'K', digits: 1 },
  { key: 'albedo_shortwave_median', label: 'Shortwave albedo (median)', digits: 3 },
  { key: 'apparent_thermal_inertia_median', label: 'Apparent thermal inertia (1 − albedo) / ΔT', unit: 'K⁻¹', digits: 4 },
  { key: 'thermal_inertia_median_tiu', label: 'Thermal inertia (median)', unit: 'tiu', digits: 0 },
  { key: 'thermal_inertia_p10_tiu', label: 'Thermal inertia, 10th percentile', unit: 'tiu', digits: 0 },
  { key: 'thermal_inertia_p90_tiu', label: 'Thermal inertia, 90th percentile', unit: 'tiu', digits: 0 },
  { key: 'thermal_inertia_interpolated_area_fraction', label: 'Window area infilled by interpolation', percent: true },
  { key: 'lunar_temp_annual_avg_k', label: 'Annual average temperature at 2 cm depth (modelled)', unit: 'K', digits: 1 },
  { key: 'lunar_temp_annual_max_k', label: 'Annual maximum surface temperature (modelled)', unit: 'K', digits: 1 },
  { key: 'lunar_ice_stable_area_fraction', label: 'Window area where water ice is modelled stable within 2.87 m', percent: true },
  { key: 'lunar_ice_stability_depth_m', label: 'Modelled ice-stability depth (median)', unit: 'm', digits: 2 },
  { key: 'thermal_valid_fraction', label: 'Window area with a day and night measurement', percent: true },
  { key: 'thermal_n_scenes_day', label: 'ECOSTRESS day scenes used', digits: 0 },
  { key: 'thermal_n_scenes_night', label: 'ECOSTRESS night scenes used', digits: 0 },
  { key: 'mineral_swath_coverage_fraction', label: 'Window area inside an EMIT swath', percent: true },
  { key: 'mineral_group2_identified_area_fraction', label: 'Swath area with a clay/carbonate/sulfate identification', percent: true },
];

const CLASS_LABEL: Record<string, string> = {
  hematite: 'hematite', goethite: 'goethite', kaolinite: 'kaolinite', smectite: 'smectite',
  illite_muscovite: 'illite / muscovite', chlorite: 'chlorite', vermiculite: 'vermiculite',
  gypsum: 'gypsum', other_sulfate: 'other sulfate', calcite: 'calcite', dolomite: 'dolomite',
  other_carbonate: 'other carbonate', other_iron_bearing: 'other iron-bearing', other: 'other',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function MineralBars({ fractions }: { fractions: Record<string, number> }) {
  const top = Object.entries(fractions).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <ul className="mt-1 space-y-1">
      {top.map(([k, v]) => (
        <li key={k} className="flex items-center gap-2 text-[11px]">
          <span className="w-36 shrink-0 text-slate-300">{CLASS_LABEL[k] ?? k}</span>
          <span className="h-2 flex-1 rounded bg-slate-800">
            <span className="block h-2 rounded bg-sky-500" style={{ width: `${Math.max(2, 100 * v)}%` }} />
          </span>
          <span className="w-10 text-right font-mono text-slate-400">{(100 * v).toFixed(0)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function EnvironmentPanel({
  env, missingReason, title,
}: { env: LocationEnvironment | null | undefined; missingReason?: string | null; title: string }) {
  const attrs = env?.attributes ?? {};
  const rows = ROWS.filter((r) => num(attrs[r.key]) !== null);
  const g1 = attrs.mineral_group1_dominant_class as string | undefined;
  const g2 = attrs.mineral_group2_dominant_class as string | undefined;
  const g2f = attrs.mineral_group2_class_fractions as Record<string, number> | undefined;

  if (!rows.length && !g2) {
    return (
      <div className="text-xs text-slate-400">
        <p className="font-medium text-slate-300">{title}</p>
        <p className="mt-1">No thermal or mineral measurement for this window. {missingReason ?? env?.error ?? ''}</p>
      </div>
    );
  }
  return (
    <div className="text-xs">
      <p className="font-medium text-slate-300">{title}</p>
      <table className="tbl mt-1 text-[11px]">
        <tbody>
          {rows.map((r) => {
            const v = num(attrs[r.key])!;
            return (
              <tr key={r.key}>
                <td className="text-slate-400">{r.label}</td>
                <td className="text-right font-mono">
                  {r.percent ? `${(100 * v).toFixed(1)} %` : v.toFixed(r.digits ?? 2)}
                  {r.unit && !r.percent ? ` ${r.unit}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(g1 || g2) && (
        <p className="mt-2 text-slate-300">
          Dominant mineral identification — iron-bearing group: <b>{CLASS_LABEL[g1 ?? ''] ?? '—'}</b>;
          {' '}clay/carbonate/sulfate group: <b>{CLASS_LABEL[g2 ?? ''] ?? '—'}</b>
        </p>
      )}
      {g2f && <MineralBars fractions={g2f} />}
      {missingReason && <p className="mt-2 text-slate-500">{missingReason}</p>}
    </div>
  );
}
