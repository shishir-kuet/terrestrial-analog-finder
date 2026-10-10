import type { ReactNode } from 'react';
import { COORD_STATUS } from '../lib/format';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-4 text-sm text-ink-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent-ink" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/[0.055] p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-danger">
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">!</span>
        Something went wrong
      </p>
      <p className="mt-1.5 text-ink-muted">{message}</p>
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
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-raised p-4 text-sm text-ink-muted">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function CoordBadge({ status }: { status: string }) {
  const s = COORD_STATUS[status] ?? { label: status, tone: 'bg-surface-sunken text-ink-muted', help: '' };
  return (
    <span className={`badge ${s.tone}`} title={s.help}>
      {s.label}
    </span>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
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
    <header className="on-dark border-b border-line">
      <div className={`mx-auto flex max-w-content flex-wrap items-end justify-between gap-x-8 gap-y-4 px-4 sm:px-6 ${compact ? 'py-4' : 'py-7'}`}>
        <div className="min-w-0 max-w-prose">
          <p className="label text-accent-ink">{eyebrow}</p>
          <h1 className={`mt-1 font-semibold tracking-tight text-ink ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{title}</h1>
          {children && <div className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </header>
  );
}

/** Horizontal bar showing a 0-100 similarity index against its full scale. */
export function IndexMeter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
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
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink ring-1 ring-inset ring-accent/30">
        {n}
      </span>
      <span className="label text-ink-muted">{children}</span>
    </p>
  );
}
