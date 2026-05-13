import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { LOCKED_SENTINEL } from '../../lib/constants';
import type { MedicalCase } from '../../types';

const GCS_MAPPING = {
  eyes: [
    { score: 4, label: 'Spontaneous' },
    { score: 3, label: 'To Speech' },
    { score: 2, label: 'To Pain' },
    { score: 1, label: 'None' },
  ],
  verbal: [
    { score: 5, label: 'Oriented' },
    { score: 4, label: 'Confused' },
    { score: 3, label: 'Inappropriate' },
    { score: 2, label: 'Incomprehensible' },
    { score: 1, label: 'None' },
  ],
  motor: [
    { score: 6, label: 'Obeys Commands' },
    { score: 5, label: 'Localizes' },
    { score: 4, label: 'Withdraws' },
    { score: 3, label: 'Abnormal Flexion' },
    { score: 2, label: 'Extension' },
    { score: 1, label: 'None' },
  ],
};

interface ExamTabProps {
  medicalCase: MedicalCase;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (category: 'eyes' | 'verbal' | 'motor', score: number) => void;
  gcsExpanded: boolean;
  onToggleGcs: () => void;
  onExamineSystem?: (system: string, finding: string) => void;
}

export function ExamTab({
  medicalCase,
  gcsState,
  onGcsChange,
  gcsExpanded,
  onToggleGcs,
  onExamineSystem,
}: ExamTabProps) {
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState<string | null>(null);

  const handleExamine = async (system: string, currentFinding: string) => {
    if (revealedFindings[system]) return;

    if (currentFinding && currentFinding !== LOCKED_SENTINEL) {
      setRevealedFindings(prev => ({ ...prev, [system]: currentFinding }));
      onExamineSystem?.(system, currentFinding);
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
        method: 'POST',
        headers,
        body: JSON.stringify({ caseId: medicalCase.id, system }),
      });
      if (res.ok) {
        const { finding } = await res.json();
        setRevealedFindings(prev => ({ ...prev, [system]: finding }));
        onExamineSystem?.(system, finding);
      } else {
        const fallback = 'Examination performed — findings within normal limits.';
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
    ([key]) => key !== 'examined'
  );

  const gcsTotal = gcsState.eyes + gcsState.verbal + gcsState.motor;

  return (
    <motion.div
      key="exam"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Body systems list */}
      <div className="space-y-1">
        {examEntries.map(([key, finding]) => {
          const isExamined = !!revealedFindings[key];
          const isLoading = loadingSystem === key;
          const label = key.charAt(0).toUpperCase() + key.slice(1);

          return (
            <div key={key} className="py-3 border-b border-gray-100 last:border-0">
              <button
                onClick={() => handleExamine(key, finding as string)}
                disabled={isExamined || isLoading}
                className={cn(
                  'w-full text-left transition-colors',
                  !isExamined && !isLoading && 'cursor-pointer'
                )}
              >
                {isExamined ? (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {revealedFindings[key]}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-400">{label}</span>
                    <span className="text-xs text-gray-300">
                      {isLoading ? 'Examining...' : 'Tap to examine'}
                    </span>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* #12: Exam complete nudge */}
      {Object.keys(revealedFindings).length === examEntries.length && examEntries.length > 0 && (
        <p className="text-sm text-gray-400 text-center pt-4">
          All systems examined — proceed to Tests
        </p>
      )}

      {/* GCS */}
      <div className="space-y-3">
        <button
          onClick={onToggleGcs}
          className="flex items-center justify-between w-full"
        >
          <span className="text-sm font-medium text-gray-500">GCS</span>
          <span className="text-sm font-mono text-gray-900">
            E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsTotal}
          </span>
        </button>

        {gcsExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-4"
          >
            {(['eyes', 'verbal', 'motor'] as const).map(category => (
              <div key={category}>
                <p className="text-xs text-gray-400 mb-2 capitalize">{category}</p>
                <select
                  value={gcsState[category]}
                  onChange={(e) => onGcsChange(category, Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-gray-400"
                >
                  {GCS_MAPPING[category].map(opt => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score} — {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
