import type { ReactNode } from 'react';
import { COORD_STATUS } from '../lib/format';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-4 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-rose-200/80">{message}</p>
      {onRetry && (
        <button className="btn-ghost mt-2" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
      <p className="font-medium text-slate-300">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function CoordBadge({ status }: { status: string }) {
  const s = COORD_STATUS[status] ?? { label: status, tone: 'bg-slate-700 text-slate-300', help: '' };
  return (
    <span className={`badge ${s.tone}`} title={s.help}>
      {s.label}
    </span>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-semibold text-slate-100">{children}</h3>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/**
 * Page banner. Every page except the landing page opens with one, so the app
 * reads as a single product rather than four separate screens.
 */
export function PageHeader({ eyebrow, title, children, aside, compact }: {
  eyebrow: string; title: ReactNode; children?: ReactNode; aside?: ReactNode; compact?: boolean;
}) {
  return (
    <header className="relative isolate overflow-hidden border-b border-slate-800/80">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.10),transparent_55%)]" />
      <div className={`relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 ${compact ? 'py-4' : 'py-7'}`}>
        <div className="rise min-w-0">
          <p className="label text-sky-300">{eyebrow}</p>
          <h1 className={`mt-1 font-bold tracking-tight text-white ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{title}</h1>
          {children && <div className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">{children}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </header>
  );
}

/** Horizontal bar showing a 0-100 similarity index against its full scale. */
export function IndexMeter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
      role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}
      aria-label="Similarity index out of 100">
      <div className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** Numbered step marker for the Explorer's configuration panel. */
export function StepLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2">
      <span aria-hidden
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/15 text-[11px] font-bold text-sky-300 ring-1 ring-inset ring-sky-500/30">
        {n}
      </span>
      <span className="label text-slate-300">{children}</span>
    </p>
  );
}
