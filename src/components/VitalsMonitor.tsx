import { useRef, useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import type { Vitals } from '../types';

interface VitalsMonitorProps {
  vitals: Vitals;
  trend: string;
  simTime: number;
  onExpand: () => void;
}

function generateEcgPath(hr: number, width: number): string {
  const cycleWidth = Math.max(30, Math.min(80, 3600 / hr));
  const cycles = Math.ceil((width * 2) / cycleWidth) + 1;
  let d = '';
  for (let i = 0; i < cycles; i++) {
    const x = i * cycleWidth;
    d += `M${x},20 `;
    d += `L${x + cycleWidth * 0.1},20 `;
    d += `L${x + cycleWidth * 0.15},22 `;
    d += `L${x + cycleWidth * 0.2},18 `;
    d += `L${x + cycleWidth * 0.3},20 `;
    d += `L${x + cycleWidth * 0.35},6 `;
    d += `L${x + cycleWidth * 0.4},34 `;
    d += `L${x + cycleWidth * 0.45},16 `;
    d += `L${x + cycleWidth * 0.5},20 `;
    d += `L${x + cycleWidth * 0.55},20 `;
    d += `L${x + cycleWidth * 0.65},14 `;
    d += `L${x + cycleWidth * 0.75},20 `;
    d += `L${x + cycleWidth},20 `;
  }
  return d;
}

function VitalValue({ label, value, unit, status }: {
  label: string;
  value: string | number;
  unit?: string;
  status: 'normal' | 'warning' | 'critical';
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <span className="text-[9px] font-medium text-clinical-slate uppercase tracking-wider">{label}</span>
      <span className={cn(
        'text-lg font-bold font-mono leading-none tabular-nums',
        status === 'critical' && 'text-clinical-red critical-flash',
        status === 'warning' && 'text-clinical-amber',
        status === 'normal' && 'text-clinical-green',
      )}>
        {value}
      </span>
      {unit && <span className="text-[8px] text-clinical-slate">{unit}</span>}
    </div>
  );
}

function getHrStatus(hr: number): 'normal' | 'warning' | 'critical' {
  if (hr > 150 || hr < 40) return 'critical';
  if (hr > 120 || hr < 50) return 'warning';
  return 'normal';
}

function getSpo2Status(spo2: number): 'normal' | 'warning' | 'critical' {
  if (spo2 < 88) return 'critical';
  if (spo2 < 94) return 'warning';
  return 'normal';
}

function getBpStatus(bp: string): 'normal' | 'warning' | 'critical' {
  const sbp = parseInt(bp.split('/')[0]) || 120;
  if (sbp < 80 || sbp > 180) return 'critical';
  if (sbp < 90 || sbp > 160) return 'warning';
  return 'normal';
}

function getRrStatus(rr: number): 'normal' | 'warning' | 'critical' {
  if (rr > 30 || rr < 8) return 'critical';
  if (rr > 24 || rr < 10) return 'warning';
  return 'normal';
}

function getTempStatus(t: number): 'normal' | 'warning' | 'critical' {
  if (t > 40 || t < 34) return 'critical';
  if (t > 38.5 || t < 36) return 'warning';
  return 'normal';
}

export function VitalsMonitor({ vitals, trend, simTime, onExpand }: VitalsMonitorProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const width = 600;
  const ecgPath = useMemo(() => generateEcgPath(vitals.heartRate, width), [vitals.heartRate, width]);
  const animDuration = useMemo(() => Math.max(2, Math.min(6, 240 / vitals.heartRate)), [vitals.heartRate]);

  const hrStatus = getHrStatus(vitals.heartRate);
  const spo2Status = getSpo2Status(vitals.oxygenSaturation);
  const bpStatus = getBpStatus(vitals.bloodPressure);
  const rrStatus = getRrStatus(vitals.respiratoryRate);
  const tempStatus = getTempStatus(vitals.temperature);

  const hasCritical = hrStatus === 'critical' || spo2Status === 'critical' || bpStatus === 'critical' || rrStatus === 'critical' || tempStatus === 'critical';

  const ecgColor = hasCritical ? 'var(--clinical-red)' : trend === 'declining' ? 'var(--clinical-amber)' : 'var(--clinical-green)';

  return (
    <button
      ref={containerRef}
      onClick={onExpand}
      className={cn(
        'w-full relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer group',
        hasCritical
          ? 'border-clinical-red/30 glow-red'
          : 'border-clinical-line hover:border-clinical-teal/30',
      )}
      style={{ background: 'var(--clinical-surface)' }}
    >
      {/* ECG waveform background */}
      <div className="absolute inset-0 overflow-hidden opacity-30 group-hover:opacity-50 transition-opacity">
        <svg
          width={width * 2}
          height="40"
          className="ecg-line absolute bottom-0"
          style={{ animationDuration: `${animDuration}s` }}
        >
          <path
            d={ecgPath}
            fill="none"
            stroke={ecgColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Vitals grid */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2.5 gap-2">
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
          <VitalValue label="HR" value={vitals.heartRate} unit="bpm" status={hrStatus} />
          <VitalValue label="BP" value={vitals.bloodPressure} unit="mmHg" status={bpStatus} />
          <VitalValue label="SpO2" value={`${vitals.oxygenSaturation}`} unit="%" status={spo2Status} />
          <VitalValue label="RR" value={vitals.respiratoryRate} unit="/min" status={rrStatus} />
          <VitalValue label="Temp" value={vitals.temperature.toFixed(1)} unit="°C" status={tempStatus} />
        </div>

        {/* Trend + time */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {trend && trend !== 'stable' && (
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              trend === 'improving' && 'bg-clinical-green-soft text-clinical-green',
              trend === 'declining' && 'bg-clinical-amber-soft text-clinical-amber',
              trend === 'critical' && 'bg-clinical-red-soft text-clinical-red critical-flash',
            )}>
              {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '⚠ Critical'}
            </span>
          )}
          <span className={cn(
            'text-[10px] font-mono font-medium',
            simTime < 30 ? 'text-clinical-slate' :
            simTime < 60 ? 'text-clinical-amber' : 'text-clinical-red'
          )}>
            T+{simTime}m
          </span>
        </div>
      </div>
    </button>
  );
}
