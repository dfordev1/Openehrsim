import React from 'react';
import { cn } from '../lib/utils';
import { Sparkline } from './Sparkline';

interface ClinicalVitalProps {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  isAlarming?: boolean;
  trend?: number[];
  onClick?: () => void;
}

export function ClinicalVital({ label, value, unit, status, isAlarming, trend, onClick }: ClinicalVitalProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 shrink-0 rounded-md transition-colors",
        isAlarming && "bg-red-50/80 ring-1 ring-clinical-red/15",
        onClick && "hover:bg-clinical-bg cursor-pointer",
        !onClick && "cursor-default"
      )}
      role="status"
      aria-label={`${label}: ${value} ${unit}`}
    >
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-clinical-slate/70 font-medium mb-0.5">{label}</span>
        <span className={cn(
          "text-sm font-semibold font-mono leading-none",
          isAlarming || status === 'critical' ? 'text-clinical-red' : status === 'abnormal' ? 'text-clinical-amber' : 'text-clinical-ink'
        )}>{value}</span>
        <span className="text-[9px] text-clinical-slate/50 mt-0.5">{unit}</span>
      </div>
      {trend && trend.length > 2 && (
        <Sparkline
          data={trend}
          color={isAlarming || status === 'critical' ? 'var(--color-clinical-red)' : status === 'abnormal' ? 'var(--color-clinical-amber)' : 'var(--color-clinical-green)'}
        />
      )}
    </button>
  );
}
