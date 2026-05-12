import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Clock, History, UserPlus } from 'lucide-react';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import { EmptyState } from '../EmptyState';
import { OrderPanel } from '../OrderPanel';
import { MedicalCase } from '../../types';

interface VitalsPoint { time: string; hr: number; sbp: number; rr: number; spo2: number; }

interface TreatmentTabProps {
  medicalCase: MedicalCase;
  vitalsHistory: VitalsPoint[];
  interventionInput: string;
  intervening: boolean;
  transferExpanded: boolean;
  onInterventionChange: (val: string) => void;
  onExecuteOrder: () => void;
  onWait: (minutes: number) => void;
  onTransfer: (dept: string) => void;
  onToggleTransfer: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onAdvanceTime: (minutes: number) => Promise<void>;
}

const DEPARTMENTS = ['ICU', 'OR / Surgery', 'Cath Lab', 'General Ward', 'Radiology'];

export function TreatmentTab({
  medicalCase, vitalsHistory, interventionInput, intervening,
  transferExpanded, onInterventionChange, onExecuteOrder,
  onWait, onTransfer, onToggleTransfer, onOrderTest, onAdvanceTime,
}: TreatmentTabProps) {

  // Build ordered-test list from labs/imaging that have orderedAt stamps
  const orderedTests = React.useMemo(() => {
    const out: Array<{ name: string; type: 'lab' | 'imaging'; orderedAt: number; availableAt: number }> = [];
    (medicalCase.labs || []).forEach((l) => {
      if (l.orderedAt !== undefined && l.availableAt !== undefined)
        out.push({ name: l.name, type: 'lab', orderedAt: l.orderedAt, availableAt: l.availableAt });
    });
    (medicalCase.imaging || []).forEach((i) => {
      if (i.orderedAt !== undefined && i.availableAt !== undefined)
        out.push({ name: i.type, type: 'imaging', orderedAt: i.orderedAt, availableAt: i.availableAt });
    });
    return out;
  }, [medicalCase.labs, medicalCase.imaging]);

  const defaultTests = { labs: ['CBC','BMP','Troponin','Lactate','ABG'], imaging: ['ECG','Chest X-ray','CT Head'] };

  return (
    <motion.div key="treatment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

      {/* ── CCS Order Panel ───────────────────────────────────────────────── */}
      <OrderPanel
        availableTests={medicalCase.availableTests ?? defaultTests}
        currentSimTime={medicalCase.simulationTime}
        onOrderTest={onOrderTest}
        onAdvanceTime={onAdvanceTime}
        orderedTests={orderedTests}
        isProcessing={intervening}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Left column ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* CPOE — free-text orders (meds, procedures, etc.) */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">CPOE — Medications &amp; Procedures</span>
            </div>
            <div className="panel-body">
              <textarea
                value={interventionInput}
                onChange={(e) => onInterventionChange(e.target.value)}
                placeholder="e.g. Vancomycin 25 mg/kg IV q8h, O2 4L via NC, Insert Foley catheter..."
                className="w-full h-24 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 resize-none"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={onExecuteOrder} disabled={intervening || !interventionInput}
                  className="flex-1 py-2.5 bg-clinical-ink text-white rounded-md font-medium text-xs hover:bg-clinical-slate disabled:opacity-30 transition-all">
                  Execute Order
                </button>
                <button onClick={() => onWait(10)} disabled={intervening}
                  className="px-4 border border-clinical-line text-clinical-slate rounded-md text-xs font-medium hover:bg-clinical-bg transition-all">
                  Wait 10m
                </button>
              </div>
            </div>
          </div>

          {/* MAR */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Medications (MAR)</span>
            </div>
            <div className="panel-body max-h-[160px] overflow-y-auto space-y-1.5">
              {(medicalCase.medications || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-clinical-slate/50">No medications administered</div>
              ) : medicalCase.medications.map((med, i) => (
                <div key={i}
                  className="flex items-center justify-between p-2.5 bg-clinical-bg/50 border border-clinical-line/50 rounded-md text-xs">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                      med.isIVFluid ? 'bg-clinical-blue/60' : 'bg-clinical-green/60')} />
                    <span className="font-medium">{med.name}</span>
                    <span className="text-clinical-slate/60">{med.dose} {med.route && `via ${med.route}`}</span>
                  </div>
                  <span className="font-mono text-[10px] text-clinical-slate">T+{med.timestamp}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transfer */}
          <div className="panel">
            <button onClick={onToggleTransfer}
              className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors">
              <span className="panel-title">Transfer Patient</span>
              <ChevronRight className={cn('w-4 h-4 text-clinical-slate/40 transition-transform', transferExpanded && 'rotate-90')} />
            </button>
            {transferExpanded && (
              <div className="panel-body space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {DEPARTMENTS.map((dept) => (
                    <button key={dept} onClick={() => onTransfer(dept)} disabled={intervening}
                      className="py-2 px-3 border border-clinical-line rounded-md text-[10px] font-medium text-clinical-slate hover:bg-clinical-blue hover:text-white hover:border-clinical-blue transition-all flex items-center gap-1.5 disabled:opacity-50">
                      <UserPlus className="w-3 h-3 shrink-0" /><span className="truncate">{dept}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* HR trend */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">HR Trend</span></div>
            <div className="p-4 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitalsHistory}>
                  <Line type="monotone" dataKey="hr" stroke="var(--color-clinical-green)"
                    strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip content={({ payload }) => (
                    <div className="text-xs text-clinical-slate bg-clinical-surface border border-clinical-line rounded px-2 py-1 shadow-sm">
                      {payload?.[0]?.value ? `${Math.round(Number(payload[0].value))} BPM` : ''}
                    </div>
                  )} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fluid balance */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Fluid Balance</span>
              <span className="text-xs font-mono text-clinical-blue">
                +{(medicalCase.medications || []).filter((m) => m.isIVFluid).reduce((s, m) => s + (m.volumeML || 0), 0)} mL
              </span>
            </div>
            <div className="panel-body">
              {(() => {
                const total  = (medicalCase.medications || []).filter((m) => m.isIVFluid).reduce((s, m) => s + (m.volumeML || 0), 0);
                const output = Math.round(medicalCase.simulationTime * 0.5 * ((medicalCase.age || 70) * 0.8 / 60));
                const maxVal = Math.max(total, output, 500);
                return (
                  <div className="flex justify-between items-end gap-3 h-20">
                    {[{ label: 'Intake', val: total, col: 'bg-clinical-blue/20', txt: 'text-clinical-blue' },
                      { label: 'Est. Output', val: output, col: 'bg-clinical-amber/20', txt: 'text-clinical-amber' }]
                      .map(({ label, val, col, txt }) => (
                        <div key={label} className="flex-1 bg-clinical-bg border border-clinical-line rounded-t relative overflow-hidden h-full">
                          <div className={cn('absolute bottom-0 left-0 right-0 transition-all duration-1000', col)}
                            style={{ height: `${Math.min(100, (val / maxVal) * 100)}%` }} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-medium text-clinical-slate z-10">
                            <span>{label}</span>
                            <span className={cn('font-mono', txt)}>{val} mL</span>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Timeline */}
          <div className="panel flex flex-col min-h-[220px] max-h-[320px]">
            <div className="panel-header"><span className="panel-title">Timeline</span></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(medicalCase.clinicalActions || []).length === 0 ? (
                <EmptyState icon={<History className="w-10 h-10" />}
                  title="Timeline empty" description="Actions appear as you manage the patient." />
              ) : (medicalCase.clinicalActions || []).map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-[10px] font-mono text-clinical-blue w-10 pt-0.5 shrink-0">T+{a.timestamp}</div>
                  <div className="flex-1 border-l border-clinical-line/50 pl-3 pb-2">
                    <p className="text-xs font-medium text-clinical-ink">{a.description}</p>
                    {(a.impact || a.result) && <p className="text-[10px] text-clinical-slate">{a.impact || a.result}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
