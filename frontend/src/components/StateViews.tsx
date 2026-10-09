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
