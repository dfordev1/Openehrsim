import { AnimatePresence, motion } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
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
  domain?: [number, number];
}

const charts: ChartConfig[] = [
  { title: 'Heart Rate', dataKey: 'hr', color: '#22c55e', unit: 'bpm', domain: [40, 180] },
  { title: 'Blood Pressure (Systolic)', dataKey: 'sbp', color: '#3b82f6', unit: 'mmHg', domain: [60, 220] },
  { title: 'SpO2', dataKey: 'spo2', color: '#f59e0b', unit: '%', domain: [80, 100] },
  { title: 'Respiratory Rate', dataKey: 'rr', color: '#ef4444', unit: '/min', domain: [6, 40] },
];

export default function VitalsExpanded({ isOpen, onClose, vitalsHistory }: VitalsExpandedProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className={cn(
            'fixed inset-0 z-50 flex flex-col',
            'bg-clinical-surface text-clinical-ink'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-clinical-line px-6 py-4">
            <h2 className="text-lg font-semibold">Vitals Trends</h2>
            <button
              onClick={onClose}
              className={cn(
                'rounded-lg p-2 transition-colors',
                'hover:bg-clinical-line/50'
              )}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Charts Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-6">
              {charts.map((chart) => (
                <div
                  key={chart.dataKey}
                  className="rounded-lg border border-clinical-line p-4"
                >
                  <h3 className="mb-2 text-sm font-medium" style={{ color: chart.color }}>
                    {chart.title} ({chart.unit})
                  </h3>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalsHistory}>
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 11 }}
                          stroke="#888"
                        />
                        <YAxis
                          domain={chart.domain}
                          tick={{ fontSize: 11 }}
                          stroke="#888"
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-clinical-surface, #1a1a2e)',
                            border: '1px solid var(--color-clinical-line, #333)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey={chart.dataKey}
                          stroke={chart.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
