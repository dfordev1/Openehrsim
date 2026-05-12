import React from 'react';
import { cn } from '../lib/utils';

interface ClinicalVitalProps {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  isAlarming?: boolean;
  trend?: number[];
}

export function ClinicalVital({ label, value, unit, status, isAlarming }: ClinicalVitalProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-3 py-1.5 shrink-0 rounded transition-colors",
        isAlarming && "bg-red-50 ring-1 ring-clinical-red/20"
      )}
      role="status"
      aria-label={`${label}: ${value} ${unit}`}
    >
      <span className="text-[10px] text-clinical-slate font-medium mb-0.5">{label}</span>
      <span className={cn(
        "text-base font-semibold font-mono leading-none",
        isAlarming || status === 'critical' ? 'text-clinical-red' : status === 'abnormal' ? 'text-clinical-amber' : 'text-clinical-ink'
      )}>{value}</span>
      <span className="text-[9px] text-clinical-slate/60 mt-0.5">{unit}</span>
    </div>
  );
}
