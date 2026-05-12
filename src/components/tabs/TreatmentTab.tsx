import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Clock, History, Loader2, UserPlus } from 'lucide-react';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import { EmptyState } from '../EmptyState';
import { OrderPanel } from '../OrderPanel';
import { MedicalCase } from '../../types';

interface VitalsHistoryPoint {
  time: string;
  hr: number;
  sbp: number;
  rr: number;
  spo2: number;
}

interface TreatmentTabProps {
  medicalCase: MedicalCase;
  vitalsHistory: VitalsHistoryPoint[];
  interventionInput: string;
  intervening: boolean;
  transferExpanded: boolean;
  onInterventionChange: (val: string) => void;
  onExecuteOrder: () => void;
  onWait: (minutes: number) => void;
  onTransfer: (dept: string) => void;
  onToggleTransfer: () => void;
  onOrderTest?: (testType: 'lab' | 'imaging', testName: string) => Promise<void>;
  onAdvanceTime?: (minutes: number) => Promise<void>;
}

const DEPARTMENTS = ['ICU', 'OR / Surgery', 'Cath Lab', 'General Ward', 'Radiology'];

export function TreatmentTab({
  medicalCase,
  vitalsHistory,
  interventionInput,
  intervening,
  transferExpanded,
  onInterventionChange,
  onExecuteOrder,
  onWait,
  onTransfer,
  onToggleTransfer,
  onOrderTest,
  onAdvanceTime,
}: TreatmentTabProps) {
  // Track ordered tests from medical case
  const orderedTests = React.useMemo(() => {
    const tests: Array<{ name: string; type: 'lab' | 'imaging'; availableAt: number; orderedAt: number }> = [];
    
    // Add labs
    (medicalCase.labs || []).forEach(lab => {
      if (lab.orderedAt !== undefined && lab.availableAt !== undefined) {
        tests.push({
          name: lab.name,
          type: 'lab',
          orderedAt: lab.orderedAt,
          availableAt: lab.availableAt,
        });
      }
    });
    
    // Add imaging
    (medicalCase.imaging || []).forEach(img => {
      if (img.orderedAt !== undefined && img.availableAt !== undefined) {
        tests.push({
          name: img.type,
          type: 'imaging',
          orderedAt: img.orderedAt,
          availableAt: img.availableAt,
        });
      }
    });
    
    return tests;
  }, [medicalCase.labs, medicalCase.imaging]);

  return (
    <motion.div key="treatment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* CCS-Style Order Panel */}
      {onOrderTest && onAdvanceTime && medicalCase.availableTests && (
        <OrderPanel
          availableTests={medicalCase.availableTests}
          currentSimTime={medicalCase.simulationTime}
          onOrderTest={onOrderTest}
          onAdvanceTime={onAdvanceTime}
          orderedTests={orderedTests}
          isProcessing={intervening}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
        {/* CPOE */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Electronic Order Entry (CPOE)</span>
          </div>
          <div className="panel-body">
            <textarea
              value={interventionInput}
              onChange={(e) => onInterventionChange(e.target.value)}
              placeholder="Order: med, dose, route, frequency..."
              className="w-full h-24 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 transition-all resize-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={onExecuteOrder}
                disabled={intervening || !interventionInput}
                className="flex-1 py-2.5 bg-clinical-ink text-white rounded-md font-medium text-xs hover:bg-clinical-slate transition-all disabled:opacity-30"
              >
                Execute Order
              </button>
              <button
                onClick={() => onWait(10)}
                disabled={intervening}
                className="px-4 border border-clinical-line text-clinical-slate rounded-md text-xs font-medium hover:bg-clinical-bg transition-all"
              >
                Wait 10m
              </button>
            </div>
          </div>
        </div>

        {/* MAR */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Medication Administration (MAR)</span>
          </div>
          <div className="panel-body">
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {(medicalCase.medications || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-clinical-slate/50">No medications administered</div>
              ) : (
                medicalCase.medications.map((med, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 bg-clinical-bg/50 border border-clinical-line/50 rounded-md text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-clinical-blue/60 rounded-full" />
                      <span className="font-medium">{med.name}</span>
                      <span className="text-clinical-slate/60">
                        {med.dose || '-'} {med.route ? `via ${med.route}` : ''}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-clinical-slate">T+{med.timestamp}m</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transfer / Timing */}
        <div className="panel">
          <button
            onClick={onToggleTransfer}
            className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors"
          >
            <span className="panel-title">Transfer / Timing</span>
            <ChevronRight
              className={cn('w-4 h-4 text-clinical-slate/40 transition-transform', transferExpanded && 'rotate-90')}
            />
          </button>
          {transferExpanded && (
            <div className="panel-body space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => onTransfer(dept)}
                    disabled={intervening}
                    className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-blue hover:text-white hover:border-clinical-blue transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserPlus className="w-3 h-3 shrink-0" />
                    <span className="truncate">{dept}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-clinical-line/50">
                <button
                  onClick={() => onWait(15)}
                  disabled={intervening}
                  className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Clock className="w-3 h-3" /> Wait 15m
                </button>
                <button
                  onClick={() => onWait(60)}
                  disabled={intervening}
                  className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-ink hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Clock className="w-3 h-3" /> Wait 1h
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* HR Trend */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">HR Trend Monitor</span>
          </div>
          <div className="p-4 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitalsHistory}>
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="var(--color-clinical-green)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip
                  content={({ payload }) => (
                    <div className="text-xs text-clinical-slate bg-clinical-surface border border-clinical-line rounded px-2 py-1 shadow-sm">
                      {payload?.[0]?.value ? `${Math.round(Number(payload[0].value))} BPM` : ''}
                    </div>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fluid Balance */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Fluid Balance</span>
            <span className="text-xs font-mono text-clinical-blue">
              +{(medicalCase.medications || []).filter((m) => m.isIVFluid).reduce((s, m) => s + (m.volumeML || 0), 0)} mL
            </span>
          </div>
          <div className="panel-body">
            {(() => {
              const ivFluids = (medicalCase.medications || []).filter((m) => m.isIVFluid);
              const totalIntake = ivFluids.reduce((s, m) => s + (m.volumeML || 0), 0);
              const estimatedOutput = Math.round(
                medicalCase.simulationTime
                  ? medicalCase.simulationTime * 0.5 * (((medicalCase.age || 70) * 0.8) / 60)
                  : 0
              );
              const maxVal = Math.max(totalIntake, estimatedOutput, 500);
              return (
                <div className="flex justify-between items-end gap-3 h-20">
                  <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-clinical-blue/20 transition-all duration-1000"
                      style={{ height: `${Math.min(100, (totalIntake / maxVal) * 100)}%` }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-medium text-clinical-slate z-10">
                      <span>Intake</span>
                      <span className="font-mono text-clinical-blue">{totalIntake} mL</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-clinical-amber/20 transition-all duration-1000"
                      style={{ height: `${Math.min(100, (estimatedOutput / maxVal) * 100)}%` }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-medium text-clinical-slate z-10">
                      <span>Est. Output</span>
                      <span className="font-mono text-clinical-amber">{estimatedOutput} mL</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Timeline */}
        <div className="panel flex flex-col min-h-[250px] max-h-[350px]">
          <div className="panel-header">
            <span className="panel-title">Timeline</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(medicalCase.clinicalActions || []).length === 0 ? (
              <EmptyState
                icon={<History className="w-10 h-10" />}
                title="Timeline empty"
                description="Actions will appear here as you intervene."
              />
            ) : (
              (medicalCase.clinicalActions || []).map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-[10px] font-mono text-clinical-slate w-10 pt-0.5 shrink-0">
                    T+{a.timestamp}
                  </div>
                  <div className="flex-1 border-l border-clinical-line/50 pl-3 pb-2">
                    <p className="text-xs font-medium text-clinical-ink mb-0.5">{a.description}</p>
                    {(a.impact || a.result) && (
                      <p className="text-[10px] text-clinical-slate">{a.impact || a.result}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
}
