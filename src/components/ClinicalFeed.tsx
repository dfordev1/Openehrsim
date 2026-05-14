import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LOCKED_SENTINEL } from '../lib/constants';
import { ActiveOrdersPanel } from './ActiveOrdersPanel';
import type { MedicalCase, LabResult, ImagingResult } from '../types';

const GCS_MAPPING = {
  eyes:   [{ score: 4, label: 'Spontaneous' }, { score: 3, label: 'To Speech' }, { score: 2, label: 'To Pain' }, { score: 1, label: 'None' }],
  verbal: [{ score: 5, label: 'Oriented' }, { score: 4, label: 'Confused' }, { score: 3, label: 'Inappropriate' }, { score: 2, label: 'Incomprehensible' }, { score: 1, label: 'None' }],
  motor:  [{ score: 6, label: 'Obeys Commands' }, { score: 5, label: 'Localizes' }, { score: 4, label: 'Withdraws' }, { score: 3, label: 'Abnormal Flexion' }, { score: 2, label: 'Extension' }, { score: 1, label: 'None' }],
};

interface Props {
  medicalCase: MedicalCase;
  simTime: number;
  intervening: boolean;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (cat: 'eyes' | 'verbal' | 'motor', score: number) => void;
  onExamineSystem: (system: string, finding: string) => void;
  onDiscontinueMedication: (id: string, name: string) => Promise<void>;
}

function Section({ title, badge, children, defaultOpen = false }: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-clinical-line">
      <button onClick={() => setOpen(p => !p)} className="w-full flex items-center justify-between py-3">
        <span className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">{title}</span>
        <div className="flex items-center gap-2">
          {badge}
          <span className="text-[10px] text-clinical-slate/50">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ClinicalFeed({ medicalCase, simTime, intervening, gcsState, onGcsChange, onExamineSystem, onDiscontinueMedication }: Props) {
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState<string | null>(null);
  const [gcsExpanded, setGcsExpanded] = useState(false);
  const [expandedImaging, setExpandedImaging] = useState<string | null>(null);

  const v = medicalCase.vitals;
  const gcsTotal = gcsState.eyes + gcsState.verbal + gcsState.motor;
  const pmh = medicalCase.pastMedicalHistory || [];
  const genderAbbr = medicalCase.gender?.toLowerCase().includes('f') ? 'F' : 'M';
  const trend = medicalCase.physiologicalTrend;
  const examEntries = Object.entries(medicalCase.physicalExam || {}).filter(([k]) => k !== 'examined');

  const handleExamine = async (system: string, currentFinding: string) => {
    if (revealedFindings[system]) return;
    if (currentFinding && currentFinding !== LOCKED_SENTINEL) {
      setRevealedFindings(prev => ({ ...prev, [system]: currentFinding }));
      onExamineSystem(system, currentFinding);
      return;
    }
    setLoadingSystem(system);
    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getSupabase } = await import('../lib/supabase');
        const supabase = getSupabase();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch {}
      const res = await fetch('/api/examine-system', {
        method: 'POST', headers,
        body: JSON.stringify({ caseId: medicalCase.id, system }),
      });
      const finding = res.ok ? (await res.json()).finding : 'Examination performed — findings documented.';
      setRevealedFindings(prev => ({ ...prev, [system]: finding }));
      onExamineSystem(system, finding);
    } catch {
      const fallback = 'Examination performed — findings documented.';
      setRevealedFindings(prev => ({ ...prev, [system]: fallback }));
      onExamineSystem(system, fallback);
    } finally {
      setLoadingSystem(null);
    }
  };

  // Build sorted result list
  type ResultItem =
    | { kind: 'lab'; data: LabResult; available: boolean }
    | { kind: 'imaging'; data: ImagingResult; available: boolean };

  const resultItems: ResultItem[] = [];
  (medicalCase.labs || []).forEach(lab => {
    if (lab.orderedAt === undefined) return;
    resultItems.push({ kind: 'lab', data: lab, available: lab.availableAt !== undefined && lab.availableAt <= simTime });
  });
  (medicalCase.imaging || []).forEach(img => {
    if (img.orderedAt === undefined) return;
    resultItems.push({ kind: 'imaging', data: img, available: img.availableAt !== undefined && img.availableAt <= simTime });
  });
  resultItems.sort((a, b) => (b.data.orderedAt ?? 0) - (a.data.orderedAt ?? 0));

  const pendingCount = resultItems.filter(r => !r.available).length;

  return (
    <div className="divide-y divide-clinical-line">

      {/* ── Vitals — always visible ── */}
      <div className="py-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">Vitals</p>
          {trend && trend !== 'stable' && (
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
              trend === 'improving' ? 'bg-green-50 text-green-600' :
              trend === 'declining' ? 'bg-amber-50 text-amber-600' :
              'bg-red-50 text-red-600 animate-pulse'
            )}>
              {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '⚠ Critical'}
            </span>
          )}
        </div>
        <p className="text-sm font-mono text-clinical-ink">
          HR {v.heartRate} · BP {v.bloodPressure} · SpO2 {v.oxygenSaturation}% · RR {v.respiratoryRate} · {v.temperature}°C
        </p>
        {v.heightCm != null && v.weightKg != null && (
          <p className="text-xs font-mono text-clinical-slate">
            {v.heightCm}cm · {v.weightKg}kg{v.bmi != null ? ` · BMI ${v.bmi.toFixed(1)}` : ''}
          </p>
        )}
      </div>

      {/* ── History — collapsed ── */}
      <Section title="History">
        <div className="space-y-4">
          <p className="text-xs text-clinical-slate">{medicalCase.age}{genderAbbr} · {medicalCase.currentLocation}</p>
          {medicalCase.initialAppearance && (
            <p className="text-sm text-clinical-ink-muted italic leading-relaxed border-l-2 border-clinical-line pl-3">
              {medicalCase.initialAppearance}
            </p>
          )}
          <div>
            <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest mb-1.5">HPI</p>
            <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-wrap">{medicalCase.historyOfPresentIllness}</p>
          </div>
          {pmh.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest mb-1.5">PMH</p>
              <ul className="space-y-0.5">
                {pmh.map((item, i) => <li key={i} className="text-sm text-clinical-ink">{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* ── Exam — collapsed, tap-to-reveal ── */}
      <Section title="Exam">
        <div>
          {examEntries.map(([key, finding]) => {
            const isExamined = !!revealedFindings[key];
            const isLoading = loadingSystem === key;
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <div key={key} className="py-2.5 border-b border-clinical-line/50 last:border-0">
                <button onClick={() => handleExamine(key, finding as string)} disabled={isExamined || isLoading} className="w-full text-left">
                  {isExamined ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p className="text-xs font-medium text-clinical-slate mb-0.5">{label}</p>
                      <p className="text-sm text-clinical-ink leading-relaxed">{revealedFindings[key]}</p>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-clinical-slate">{label}</span>
                      <span className="text-xs text-clinical-slate/50">{isLoading ? 'Examining…' : 'Tap to examine'}</span>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
          <div className="pt-3 space-y-2">
            <button onClick={() => setGcsExpanded(p => !p)} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-clinical-slate">GCS</span>
              <span className="text-sm font-mono text-clinical-ink">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsTotal}</span>
            </button>
            {gcsExpanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-3">
                {(['eyes', 'verbal', 'motor'] as const).map(cat => (
                  <div key={cat}>
                    <p className="text-xs text-clinical-slate mb-1 capitalize">{cat}</p>
                    <select value={gcsState[cat]} onChange={e => onGcsChange(cat, Number(e.target.value))} className="w-full text-sm border border-clinical-line rounded-md px-2 py-1 focus:outline-none focus:border-clinical-blue bg-clinical-surface text-clinical-ink">
                      {GCS_MAPPING[cat].map(opt => <option key={opt.score} value={opt.score}>{opt.score} — {opt.label}</option>)}
                    </select>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Results — open, updates live ── */}
      <Section
        title="Results"
        defaultOpen
        badge={pendingCount > 0 ? (
          <span className="text-[10px] bg-clinical-amber-soft text-clinical-amber rounded-full px-1.5 py-0.5">{pendingCount} pending</span>
        ) : undefined}
      >
        {resultItems.length === 0 ? (
          <p className="text-xs text-clinical-slate/50">No tests ordered yet.</p>
        ) : (
          <div>
            {resultItems.map((item, i) => {
              if (item.kind === 'lab') {
                const lab = item.data;
                return (
                  <div key={`lab-${lab.name}-${i}`} className="py-2 border-b border-clinical-line/50 flex items-baseline justify-between">
                    <span className={cn('text-sm', !item.available ? 'text-clinical-slate/40' : 'text-clinical-ink-muted')}>{lab.name}</span>
                    {!item.available ? (
                      <span className="text-xs text-clinical-slate/40">T+{lab.availableAt}m</span>
                    ) : (
                      <span className={cn('font-mono text-sm',
                        lab.status === 'critical' && 'font-bold text-clinical-red bg-clinical-red-soft px-1.5 rounded',
                        lab.status === 'abnormal' && 'font-bold text-clinical-red',
                        lab.status === 'normal' && 'text-clinical-ink'
                      )}>{lab.value} {lab.unit}</span>
                    )}
                  </div>
                );
              }
              const img = item.data;
              const imgKey = `${img.type}-${i}`;
              const isExpanded = expandedImaging === imgKey;
              return (
                <div key={`img-${img.type}-${i}`} className="border-b border-clinical-line/50">
                  <button
                    onClick={() => item.available && setExpandedImaging(isExpanded ? null : imgKey)}
                    disabled={!item.available}
                    className={cn('w-full text-left py-2 flex items-baseline justify-between', item.available && 'hover:bg-clinical-line/30 -mx-1 px-1 rounded')}
                  >
                    <span className={cn('text-sm', !item.available ? 'text-clinical-slate/40' : 'text-clinical-ink-muted')}>{img.type}</span>
                    {!item.available
                      ? <span className="text-xs text-clinical-slate/40">T+{img.availableAt ?? '?'}m</span>
                      : <span className="text-xs text-clinical-slate">{isExpanded ? '▲' : '▼ Report'}</span>
                    }
                  </button>
                  {isExpanded && item.available && (
                    <div className="rounded-lg p-3 mb-2 space-y-2" style={{ background: 'var(--clinical-surface-raised)' }}>
                      {img.findings && <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-line">{img.findings}</p>}
                      {img.impression && (
                        <p className="text-sm font-medium text-clinical-ink border-t border-clinical-line pt-2">{img.impression}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Active Orders — collapsed ── */}
      <Section title="Active Orders">
        <ActiveOrdersPanel medicalCase={medicalCase} simTime={simTime} intervening={intervening} onDiscontinue={onDiscontinueMedication} />
      </Section>

      {/* ── Activity — collapsed ── */}
      {(medicalCase.clinicalActions || []).length > 0 && (
        <Section title="Activity">
          <div className="space-y-1">
            {[...medicalCase.clinicalActions].reverse().map((action, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="font-mono shrink-0 text-clinical-slate/50">T+{action.timestamp}m</span>
                <span className="text-clinical-slate">{action.description}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
