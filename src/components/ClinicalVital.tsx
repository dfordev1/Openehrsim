import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Sparkline } from './Sparkline';

interface ClinicalVitalProps {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  isAlarming?: boolean;
  trend?: number[];
}

export function ClinicalVital({ label, value, unit, status, isAlarming, trend }: ClinicalVitalProps) {
  const getTrend = () => {
    if (!trend || trend.length < 2) return null;
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    if (last > prev + 1) return <ArrowUp className="w-2.5 h-2.5 text-clinical-red" aria-label="Rising" />;
    if (last < prev - 1) return <ArrowDown className="w-2.5 h-2.5 text-clinical-blue" aria-label="Falling" />;
    return null;
  };

  return (
    <div
      className={cn(
        "flex flex-col px-3 md:px-4 py-2 transition-all shrink-0 border-r border-clinical-line last:border-r-0",
        isAlarming && "bg-clinical-red/10 animate-pulse rounded"
      )}
      role="status"
      aria-label={`${label}: ${value} ${unit}${isAlarming ? ', alarming' : ''}`}
    >
      <div className="text-[9px] font-bold text-clinical-slate uppercase tracking-tighter opacity-70 mb-0.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {label}
          {isAlarming && <div className="w-1.5 h-1.5 bg-clinical-red rounded-full" aria-hidden="true" />}
        </div>
        {trend && <Sparkline data={trend} color={isAlarming || status === 'critical' ? '#ef4444' : status === 'abnormal' ? '#f59e0b' : '#3b82f6'} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn(
          "text-lg md:text-xl font-mono font-bold leading-none tracking-tight",
          isAlarming || status === 'critical' ? 'text-clinical-red' : status === 'abnormal' ? 'text-clinical-amber' : 'text-clinical-ink'
        )}>{value}</span>
        <div className="flex flex-col">
          <span className="text-[9px] text-clinical-slate font-bold opacity-40 uppercase leading-none">{unit}</span>
          {getTrend()}
        </div>
      </div>
    </div>
  );
}
