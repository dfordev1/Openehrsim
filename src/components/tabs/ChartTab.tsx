import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { LOCKED_SENTINEL } from '../../lib/constants';
import type { MedicalCase } from '../../types';

const GCS_MAPPING = {
  eyes:   [{ score: 4, label: 'Spontaneous' }, { score: 3, label: 'To Speech' }, { score: 2, label: 'To Pain' }, { score: 1, label: 'None' }],
  verbal: [{ score: 5, label: 'Oriented' }, { score: 4, label: 'Confused' }, { score: 3, label: 'Inappropriate' }, { score: 2, label: 'Incomprehensible' }, { score: 1, label: 'None' }],
  motor:  [{ score: 6, label: 'Obeys Commands' }, { score: 5, label: 'Localizes' }, { score: 4, label: 'Withdraws' }, { score: 3, label: 'Abnormal Flexion' }, { score: 2, label: 'Extension' }, { score: 1, label: 'None' }],
};

interface ChartTabProps {
  medicalCase: MedicalCase;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (cat: 'eyes' | 'verbal' | 'motor', score: number) => void;
  gcsExpanded: boolean;
  onToggleGcs: () => void;
  onExamineSystem: (system: string, finding: string) => void;
}

export function ChartTab({ medicalCase, gcsState, onGcsChange, gcsExpanded, onToggleGcs, onExamineSystem }: ChartTabProps) {
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState<string | null>(null);
  const genderAbbr = medicalCase.gender?.toLowerCase().includes('f') ? 'F' : 'M';
  const pmh = medicalCase.pastMedicalHistory || [];
  const v = medicalCase.vitals;
  const gcsTotal = gcsState.eyes + gcsState.verbal + gcsState.motor;

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
        const { getSupabase } = await import('../../lib/supabase');
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

  const examEntries = Object.entries(medicalCase.physicalExam || {}).filter(([k]) => k !== 'examined');

  return (
    <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-10 py-8">

      {/* Chief complaint */}
      <p className="text-xl font-medium text-clinical-ink leading-relaxed">
        &ldquo;{medicalCase.chiefComplaint}&rdquo;
      </p>

      {/* Demographics */}
      <p className="text-sm text-clinical-slate">
        {medicalCase.age}{genderAbbr} · {medicalCase.currentLocation}
      </p>

      {/* Vitals */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">Vitals</p>
        <p className="text-sm font-mono text-clinical-ink">
          HR {v.heartRate} · BP {v.bloodPressure} · SpO2 {v.oxygenSaturation}% · RR {v.respiratoryRate} · {v.temperature}°C
        </p>
        {v.heightCm != null && v.weightKg != null && (
          <p className="text-xs font-mono text-clinical-slate">
            {v.heightCm}cm · {v.weightKg}kg{v.bmi != null ? ` · BMI ${v.bmi.toFixed(1)}` : ''}
          </p>
        )}
      </div>

      {/* Initial appearance */}
      {medicalCase.initialAppearance && (
        <p className="text-sm text-clinical-slate italic leading-relaxed border-l-2 border-clinical-line pl-3">
          {medicalCase.initialAppearance}
        </p>
      )}

      {/* HPI */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">History of Present Illness</p>
        <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-wrap">
          {medicalCase.historyOfPresentIllness}
        </p>
      </div>

      {/* PMH */}
      {pmh.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">Past Medical History</p>
          <ul className="space-y-1">
            {pmh.map((item, i) => <li key={i} className="text-sm text-clinical-ink">{item}</li>)}
          </ul>
        </div>
      )}

      {/* Physical exam — tap to reveal */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest mb-3">Physical Examination</p>
        {examEntries.map(([key, finding]) => {
          const isExamined = !!revealedFindings[key];
          const isLoading = loadingSystem === key;
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <div key={key} className="py-3 border-b border-clinical-line last:border-0">
              <button
                onClick={() => handleExamine(key, finding as string)}
                disabled={isExamined || isLoading}
                className="w-full text-left"
              >
                {isExamined ? (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p className="text-xs font-medium text-clinical-slate mb-0.5">{label}</p>
                      <p className="text-sm text-clinical-ink leading-relaxed">{revealedFindings[key]}</p>
                    </motion.div>
                  </AnimatePresence>
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

        {/* GCS */}
        <div className="pt-3 space-y-3">
          <button onClick={onToggleGcs} className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-clinical-slate">GCS</span>
            <span className="text-sm font-mono text-clinical-ink">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsTotal}</span>
          </button>
          {gcsExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-4">
              {(['eyes', 'verbal', 'motor'] as const).map(cat => (
                <div key={cat}>
                  <p className="text-xs text-clinical-slate mb-2 capitalize">{cat}</p>
                  <select
                    value={gcsState[cat]}
                    onChange={e => onGcsChange(cat, Number(e.target.value))}
                    className="w-full text-sm border border-clinical-line rounded-md px-2 py-1.5 focus:outline-none focus:border-clinical-teal"
                  >
                    {GCS_MAPPING[cat].map(opt => (
                      <option key={opt.score} value={opt.score}>{opt.score} — {opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {Object.keys(revealedFindings).length === examEntries.length && examEntries.length > 0 && (
        <p className="text-sm text-clinical-slate text-center pt-2">All systems examined — proceed to Orders</p>
      )}
    </motion.div>
  );
}
