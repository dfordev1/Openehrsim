import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Stethoscope, Eye, Heart, Wind, Activity, Hand, Brain } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MedicalCase } from '../../types';

const GCS_MAPPING = {
  eyes: [
    { score: 4, label: 'Spontaneous', desc: 'Eyes open without stimulation' },
    { score: 3, label: 'To Speech', desc: 'Eyes open to name or command' },
    { score: 2, label: 'To Pain', desc: 'Eyes open to pressure stimulation' },
    { score: 1, label: 'None', desc: 'No eye opening' },
  ],
  verbal: [
    { score: 5, label: 'Oriented', desc: 'Correctly gives name, place, date' },
    { score: 4, label: 'Confused', desc: 'Not oriented but coherent' },
    { score: 3, label: 'Inappropriate', desc: 'Isolated words or phrases' },
    { score: 2, label: 'Incomprehensible', desc: 'Moans, groans, no words' },
    { score: 1, label: 'None', desc: 'No vocalization' },
  ],
  motor: [
    { score: 6, label: 'Obeys Commands', desc: 'Performs simple movements' },
    { score: 5, label: 'Localizes Pain', desc: 'Moves toward painful stimulus' },
    { score: 4, label: 'Withdraws', desc: 'Flexion withdrawal to pain' },
    { score: 3, label: 'Abnormal Flexion', desc: 'Decorticate posturing' },
    { score: 2, label: 'Extension', desc: 'Decerebrate posturing' },
    { score: 1, label: 'None', desc: 'No motor response' },
  ],
};

// Label + icon for each exam system
const SYSTEM_META: Record<string, { label: string; icon: ReactNode }> = {
  heent:        { label: 'HEENT',         icon: <Eye        className="w-4 h-4" /> },
  cardiac:      { label: 'Cardiovascular',icon: <Heart      className="w-4 h-4" /> },
  respiratory:  { label: 'Respiratory',   icon: <Wind       className="w-4 h-4" /> },
  abdomen:      { label: 'Abdomen',       icon: <Activity   className="w-4 h-4" /> },
  extremities:  { label: 'Extremities',   icon: <Hand       className="w-4 h-4" /> },
  neurological: { label: 'Neurological',  icon: <Brain      className="w-4 h-4" /> },
};

interface ExamTabProps {
  medicalCase: MedicalCase;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (category: 'eyes' | 'verbal' | 'motor', score: number) => void;
  gcsExpanded: boolean;
  onToggleGcs: () => void;
  /** Called when the user examines a system — adds a clinical action */
  onExamineSystem?: (system: string, finding: string) => void;
}

/** Sentinel value set by generate-case.ts for all locked systems */
const LOCKED_SENTINEL = 'Not yet examined';

export function ExamTab({
  medicalCase,
  gcsState,
  onGcsChange,
  gcsExpanded,
  onToggleGcs,
  onExamineSystem,
}: ExamTabProps) {
  // Map of system → revealed finding text (populated on Examine click)
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState<string | null>(null);

  const handleExamine = async (system: string, currentFinding: string) => {
    if (revealedFindings[system]) return; // already done

    // If the finding is already real (non-sentinel), reveal immediately
    if (currentFinding && currentFinding !== LOCKED_SENTINEL) {
      setRevealedFindings(prev => ({ ...prev, [system]: currentFinding }));
      onExamineSystem?.(system, currentFinding);
      return;
    }

    // Otherwise fetch the real finding from the server
    setLoadingSystem(system);
    try {
      const res = await fetch('/api/examine-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: medicalCase.id, system }),
      });
      if (res.ok) {
        const { finding } = await res.json();
        setRevealedFindings(prev => ({ ...prev, [system]: finding }));
        onExamineSystem?.(system, finding);
      } else {
        // Fallback: mark as examined with a generic note
        const fallback = 'Examination performed — findings within normal limits for presentation.';
        setRevealedFindings(prev => ({ ...prev, [system]: fallback }));
        onExamineSystem?.(system, fallback);
      }
    } catch {
      const fallback = 'Examination performed — findings documented.';
      setRevealedFindings(prev => ({ ...prev, [system]: fallback }));
      onExamineSystem?.(system, fallback);
    } finally {
      setLoadingSystem(null);
    }
  };

  const examEntries = Object.entries(medicalCase.physicalExam || {}).filter(
    ([key]) => key !== 'examined' // skip the meta field
  );

  const examinedCount = Object.keys(revealedFindings).length;
  const totalSystems  = examEntries.length;

  /** Sequentially examine all unexamined systems */
  const handleExamineAll = async () => {
    for (const [key, finding] of examEntries) {
      if (revealedFindings[key]) continue;
      await handleExamine(key, finding as string);
    }
  };

  return (
    <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">

      {/* GCS ─────────────────────────────────────────────────────────────── */}
      <div className="panel">
        <button
          onClick={onToggleGcs}
          className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors"
        >
          <span className="panel-title">Glasgow Coma Scale (GCS)</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-semibold text-clinical-blue">
              E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} ={' '}
              {gcsState.eyes + gcsState.verbal + gcsState.motor}
            </span>
            <ChevronRight className={cn('w-4 h-4 text-clinical-slate/40 transition-transform', gcsExpanded && 'rotate-90')} />
          </div>
        </button>
        {gcsExpanded && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['eyes', 'verbal', 'motor'] as const).map(category => (
              <div key={category} className="space-y-2" role="radiogroup" aria-label={`${category} response`}>
                <label className="text-[10px] font-medium text-clinical-slate uppercase tracking-wide">
                  {category} Response
                </label>
                <div className="flex flex-col gap-1">
                  {GCS_MAPPING[category].map(option => (
                    <button
                      key={option.score}
                      onClick={() => onGcsChange(category, option.score)}
                      role="radio"
                      aria-checked={gcsState[category] === option.score}
                      className={cn(
                        'text-left p-2.5 rounded-md text-xs transition-all border',
                        gcsState[category] === option.score
                          ? 'bg-clinical-blue/10 text-clinical-blue border-clinical-blue/30 font-medium'
                          : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue/20 text-clinical-ink'
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span>{option.label}</span>
                        <span className="text-[10px] font-mono text-clinical-slate/50">{option.score}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Physical Exam — CCS style: examine each system one at a time ─────── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <Stethoscope className="w-3.5 h-3.5" />
            Physical Examination
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-clinical-slate font-mono">
              {examinedCount}/{totalSystems} systems examined
            </span>
            {examinedCount < totalSystems && (
              <button
                onClick={handleExamineAll}
                disabled={!!loadingSystem}
                className="text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 hover:bg-clinical-blue/20 px-2.5 py-1 rounded-md transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <Stethoscope className="w-3 h-3" />
                Examine All
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-clinical-line/50 mx-5 mb-0">
          <div
            className="h-full bg-clinical-blue transition-all duration-500"
            style={{ width: `${totalSystems ? (examinedCount / totalSystems) * 100 : 0}%` }}
          />
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {examEntries.map(([key, finding]) => {
            const meta       = SYSTEM_META[key] ?? { label: key.toUpperCase(), icon: <Stethoscope className="w-4 h-4" /> };
            const isExamined = !!revealedFindings[key];
            const isLoading  = loadingSystem === key;

            return (
              <div
                key={key}
                className={cn(
                  'rounded-lg border transition-all',
                  isExamined
                    ? 'bg-clinical-bg/60 border-clinical-blue/20'
                    : 'bg-clinical-surface border-clinical-line'
                )}
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-clinical-line/50">
                  <div className="flex items-center gap-2 text-clinical-slate">
                    {meta.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      {meta.label}
                    </span>
                  </div>

                  {isExamined ? (
                    <span className="text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 px-2 py-0.5 rounded-full">
                      Examined
                    </span>
                  ) : (
                    <button
                      onClick={() => handleExamine(key, finding as string)}
                      disabled={isLoading}
                      className="text-[10px] font-medium text-white bg-clinical-ink hover:bg-clinical-slate px-2.5 py-1 rounded-md transition-all flex items-center gap-1 disabled:opacity-60"
                    >
                      {isLoading
                        ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Examining...</>
                        : <><Stethoscope className="w-3 h-3" />Examine</>
                      }
                    </button>
                  )}
                </div>

                {/* Finding — revealed only after examination */}
                <AnimatePresence>
                  {isExamined ? (
                    <motion.div
                      key="finding"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="px-3 py-2.5"
                    >
                      <p className="text-sm text-clinical-ink leading-relaxed">
                        {revealedFindings[key]}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="placeholder"
                      className="px-3 py-3 flex items-center gap-2"
                    >
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-12 h-2 rounded bg-clinical-line/60"
                            style={{ opacity: 1 - i * 0.25 }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-clinical-slate/50 italic">
                        {isLoading ? 'Examining…' : 'Click Examine to reveal'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* All systems examined callout */}
        {examinedCount === totalSystems && totalSystems > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5 text-xs text-green-800 dark:text-green-200"
          >
            <Stethoscope className="w-3.5 h-3.5 shrink-0" />
            Full physical examination complete — all systems documented.
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
