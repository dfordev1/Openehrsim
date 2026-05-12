import { AnimatePresence, motion } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface VitalsHistoryEntry {
  time: string;
  hr: number;
  sbp: number;
  rr: number;
  spo2: number;
}

interface VitalsExpandedProps {
  isOpen: boolean;
  onClose: () => void;
  vitalsHistory: VitalsHistoryEntry[];
}

interface ChartConfig {
  title: string;
  dataKey: keyof VitalsHistoryEntry;
  color: string;
  unit: string;
  domain: [number, number];
  normal: { low: number; high: number };
  // Thresholds for status colouring
  critical: { low: number; high: number };
  abnormal: { low: number; high: number };
  description: string;
}

const charts: ChartConfig[] = [
  {
    title: 'Heart Rate',
    dataKey: 'hr',
    color: '#22c55e',
    unit: 'bpm',
    domain: [30, 200],
    normal:   { low: 60,  high: 100 },
    abnormal: { low: 50,  high: 120 },
    critical: { low: 40,  high: 150 },
    description: 'Normal sinus rhythm: 60–100 bpm',
  },
  {
    title: 'Systolic Blood Pressure',
    dataKey: 'sbp',
    color: '#3b82f6',
    unit: 'mmHg',
    domain: [50, 240],
    normal:   { low: 90,  high: 140 },
    abnormal: { low: 80,  high: 160 },
    critical: { low: 70,  high: 180 },
    description: 'Target SBP: 90–140 mmHg',
  },
  {
    title: 'SpO₂',
    dataKey: 'spo2',
    color: '#f59e0b',
    unit: '%',
    domain: [80, 100],
    normal:   { low: 95,  high: 100 },
    abnormal: { low: 90,  high: 100 },
    critical: { low: 88,  high: 100 },
    description: 'Target SpO₂: ≥ 95%',
  },
  {
    title: 'Respiratory Rate',
    dataKey: 'rr',
    color: '#ef4444',
    unit: '/min',
    domain: [4, 50],
    normal:   { low: 12,  high: 20 },
    abnormal: { low: 10,  high: 24 },
    critical: { low: 8,   high: 30 },
    description: 'Normal RR: 12–20 breaths/min',
  },
];

function getStatus(value: number, cfg: ChartConfig): 'normal' | 'abnormal' | 'critical' {
  if (value < cfg.critical.low || value > cfg.critical.high) return 'critical';
  if (value < cfg.abnormal.low || value > cfg.abnormal.high) return 'abnormal';
  if (value < cfg.normal.low   || value > cfg.normal.high)   return 'abnormal';
  return 'normal';
}

const statusColour: Record<string, string> = {
  normal:   'text-clinical-green',
  abnormal: 'text-clinical-amber',
  critical: 'text-clinical-red',
};

const statusBg: Record<string, string> = {
  normal:   'bg-green-50/80',
  abnormal: 'bg-amber-50/80',
  critical: 'bg-red-50/80',
};

const statusLabel: Record<string, string> = {
  normal:   'Normal',
  abnormal: 'Abnormal',
  critical: 'Critical',
};

export default function VitalsExpanded({ isOpen, onClose, vitalsHistory }: VitalsExpandedProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col bg-clinical-surface text-clinical-ink"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-clinical-line px-6 py-4 shrink-0">
            <div>
              <h2 className="text-lg font-semibold">Vitals Monitor</h2>
              <p className="text-[10px] text-clinical-slate uppercase tracking-wide mt-0.5">
                Trending last {vitalsHistory.length} readings · click outside to dismiss
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-clinical-bg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Charts grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {charts.map((chart) => {
                const latest = vitalsHistory.length > 0
                  ? Number(vitalsHistory[vitalsHistory.length - 1][chart.dataKey])
                  : null;
                const status = latest !== null ? getStatus(latest, chart) : 'normal';

                return (
                  <div
                    key={chart.dataKey}
                    className={cn(
                      'rounded-xl border p-5 transition-colors',
                      status === 'critical' ? 'border-clinical-red/40 bg-red-50/30' :
                      status === 'abnormal' ? 'border-clinical-amber/40 bg-amber-50/20' :
                      'border-clinical-line'
                    )}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-clinical-ink">{chart.title}</h3>
                        <p className="text-[10px] text-clinical-slate mt-0.5">{chart.description}</p>
                      </div>
                      <div className="text-right">
                        {latest !== null && (
                          <>
                            <div className={cn('text-2xl font-bold font-mono leading-none', statusColour[status])}>
                              {chart.dataKey === 'spo2' || chart.dataKey === 'rr'
                                ? Math.round(latest)
                                : Math.round(latest)}
                            </div>
                            <div className="text-[10px] text-clinical-slate">{chart.unit}</div>
                            <span className={cn(
                              'inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full',
                              statusColour[status], statusBg[status]
                            )}>
                              {statusLabel[status]}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Normal range indicator */}
                    <div className="flex items-center gap-2 mb-3 text-[10px] text-clinical-slate">
                      <div className="flex-1 h-1.5 bg-clinical-line rounded-full overflow-hidden relative">
                        {/* Normal band */}
                        <div
                          className="absolute h-full bg-clinical-green/30"
                          style={{
                            left: `${((chart.normal.low - chart.domain[0]) / (chart.domain[1] - chart.domain[0])) * 100}%`,
                            width: `${((chart.normal.high - chart.normal.low) / (chart.domain[1] - chart.domain[0])) * 100}%`,
                          }}
                        />
                        {/* Current value marker */}
                        {latest !== null && (
                          <div
                            className={cn('absolute top-0 bottom-0 w-1 rounded-full', statusColour[status].replace('text-', 'bg-'))}
                            style={{
                              left: `${Math.min(98, Math.max(1, ((latest - chart.domain[0]) / (chart.domain[1] - chart.domain[0])) * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                      <span className="whitespace-nowrap">
                        Normal: {chart.normal.low}–{chart.normal.high} {chart.unit}
                      </span>
                    </div>

                    {/* Chart */}
                    <div className="h-[120px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsHistory}>
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#888" interval="preserveStartEnd" />
                          <YAxis domain={chart.domain} tick={{ fontSize: 10 }} stroke="#888" width={36} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--clinical-surface)',
                              border: '1px solid var(--clinical-line)',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                            formatter={(v: any) => [`${Math.round(Number(v))} ${chart.unit}`, chart.title]}
                          />
                          {/* Normal range reference band */}
                          <ReferenceLine y={chart.normal.low}  stroke={chart.color} strokeDasharray="3 3" strokeOpacity={0.4} />
                          <ReferenceLine y={chart.normal.high} stroke={chart.color} strokeDasharray="3 3" strokeOpacity={0.4} />
                          <Line
                            type="monotone"
                            dataKey={chart.dataKey}
                            stroke={status === 'critical' ? '#ef4444' : status === 'abnormal' ? '#f59e0b' : chart.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Range table */}
                    <div className="mt-3 grid grid-cols-3 gap-1 text-[9px]">
                      {[
                        { label: 'Normal',   low: chart.normal.low,   high: chart.normal.high,   cls: 'bg-green-50 text-green-700' },
                        { label: 'Abnormal', low: chart.abnormal.low, high: chart.abnormal.high, cls: 'bg-amber-50 text-amber-700' },
                        { label: 'Critical', low: chart.critical.low, high: chart.critical.high, cls: 'bg-red-50 text-red-700' },
                      ].map(({ label, low, high, cls }) => (
                        <div key={label} className={cn('rounded px-2 py-1 text-center', cls)}>
                          <div className="font-bold">{label}</div>
                          <div className="font-mono">{low}–{high}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
