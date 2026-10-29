import type { ReactNode } from 'react';
import { btnSecondary } from './ui';

export function LoadingState({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div
      data-nosnippet
      aria-hidden="true"
      className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500 dark:text-slate-400 font-medium"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600 dark:border-slate-700 dark:border-t-emerald-400" />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <span className="text-3xl block mb-2">⚠️</span>
      <p className="text-sm font-bold text-red-900 dark:text-red-200">Gagal memuat data</p>
      <p className="mt-1 text-xs text-red-700 dark:text-red-300/90 leading-relaxed max-w-lg mx-auto">
        {message}
      </p>
      {onRetry && (
        <button type="button" className={`${btnSecondary} mt-4 text-xs`} onClick={onRetry}>
          🔄 Coba lagi
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="text-4xl block mb-2 opacity-50">📦</span>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
