import { cn } from '../lib/utils';
import { Sparkline } from './Sparkline';

interface ClinicalVitalProps {
  label: string;
  value: string | number;
  unit: string;
  /** Pass 'normal'|'abnormal'|'critical' OR leave as 'normal' and let the
   *  component auto-compute the real status from the numeric value. */
  status: 'normal' | 'abnormal' | 'critical';
  isAlarming?: boolean;
  trend?: number[];
  onClick?: () => void;
}

/** Derive the clinical status from the raw vital value + label. */
function deriveStatus(label: string, value: string | number): 'normal' | 'abnormal' | 'critical' {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return 'normal';

  switch (label) {
    case 'HR':
      if (num < 40 || num > 150) return 'critical';
      if (num < 50 || num > 120) return 'abnormal';
      return 'normal';

    case 'BP': {
      // value is like "90/60"
      const sbp = typeof value === 'string' ? parseInt(value.split('/')[0]) : num;
      if (sbp < 80 || sbp > 180) return 'critical';
      if (sbp < 90 || sbp > 160) return 'abnormal';
      return 'normal';
    }

    case 'SpO2':
      if (num < 88) return 'critical';
      if (num < 94) return 'abnormal';
      return 'normal';

    case 'RR':
      if (num < 8 || num > 30) return 'critical';
      if (num < 12 || num > 24) return 'abnormal';
      return 'normal';

    case 'Temp':
      if (num < 34 || num > 40.5) return 'critical';
      if (num < 36 || num > 38.5) return 'abnormal';
      return 'normal';

    default:
      return 'normal';
  }
}

/** Return ↑ ↓ → based on last two trend values */
function trendArrow(trend?: number[]): { arrow: string; cls: string } | null {
  if (!trend || trend.length < 2) return null;
  const prev = trend[trend.length - 2];
  const curr = trend[trend.length - 1];
  const delta = curr - prev;
  if (Math.abs(delta) < 0.5) return { arrow: '→', cls: 'text-clinical-slate/50' };
  return delta > 0
    ? { arrow: '↑', cls: 'text-clinical-amber' }
    : { arrow: '↓', cls: 'text-clinical-blue' };
}

export function ClinicalVital({ label, value, unit, status: _passedStatus, isAlarming, trend, onClick }: ClinicalVitalProps) {
  const status = deriveStatus(label, value);

  const arrow = trendArrow(trend);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 shrink-0 rounded-md transition-colors',
        (isAlarming || status === 'critical') && 'bg-red-50/80 ring-1 ring-clinical-red/20',
        status === 'abnormal' && !isAlarming && 'bg-amber-50/60',
        onClick && 'hover:bg-clinical-bg cursor-pointer',
        !onClick && 'cursor-default'
      )}
      role="status"
      aria-label={`${label}: ${value} ${unit}`}
    >
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-clinical-slate/70 font-medium mb-0.5">{label}</span>
        <div className="flex items-baseline gap-0.5">
          <span className={cn(
            'text-sm font-semibold font-mono leading-none',
            (isAlarming || status === 'critical') ? 'text-clinical-red' :
            status === 'abnormal'                 ? 'text-clinical-amber' :
                                                    'text-clinical-ink'
          )}>{value}</span>
          {arrow && (
            <span className={cn('text-[10px] font-bold leading-none', arrow.cls)}>{arrow.arrow}</span>
          )}
        </div>
        <span className="text-[9px] text-clinical-slate/50 mt-0.5">{unit}</span>
      </div>
      {trend && trend.length > 2 && (
        <Sparkline
          data={trend}
          color={
            (isAlarming || status === 'critical') ? 'var(--color-clinical-red)' :
            status === 'abnormal'                 ? 'var(--color-clinical-amber)' :
                                                    'var(--color-clinical-green)'
          }
        />
      )}
    </button>
  );
}
