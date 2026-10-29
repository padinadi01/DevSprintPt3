import { useTheme } from '../lib/theme';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Ganti ke mode ${isDark ? 'terang' : 'gelap'}`}
      title={`Mode saat ini: ${isDark ? 'Gelap (Dark Mode)' : 'Terang (Light Mode)'}. Klik untuk beralih.`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        compact ? 'p-2' : 'px-3 py-1.5 text-xs'
      } ${
        isDark
          ? 'bg-[#141d33] border-slate-700/80 text-amber-300 hover:bg-[#1c2946] hover:text-amber-200 shadow-xs'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs'
      } ${className}`}
    >
      <span className="text-sm leading-none transition-transform duration-200">
        {isDark ? '🌙' : '☀️'}
      </span>
      {!compact && (
        <span className="font-semibold tracking-tight">
          {isDark ? 'Mode Gelap' : 'Mode Terang'}
        </span>
      )}
    </button>
  );
}
