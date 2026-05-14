import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { CaseEvaluation, MedicalCase } from '../../types';

interface AssessmentTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  userNotes: string;
  evaluation: CaseEvaluation | null;
  submitting: boolean;
  logs: { time: string; text: string }[];
  onNotesChange: (val: string) => void;
  differential: string;
  onDifferentialChange: (val: string) => void;
  onEndCase: () => void;
  onNewCase: () => void;
}

export function AssessmentTab({
  medicalCase,
  simTime,
  userNotes,
  evaluation,
  submitting,
  logs,
  onNotesChange,
  differential,
  onDifferentialChange,
  onEndCase,
  onNewCase,
}: AssessmentTabProps) {
  const closed = !!evaluation;
  const score = evaluation?.score ?? 0;
  const feedbackText = evaluation?.feedback ?? '';
  const correctDx = evaluation?.correctDiagnosis ?? medicalCase.correctDiagnosis;

  // #6: Two-step end case confirmation
  const [confirmState, setConfirmState] = useState<'idle' | 'confirming'>('idle');
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const handleEndCaseClick = () => {
    if (confirmState === 'idle') {
      setConfirmState('confirming');
      confirmTimerRef.current = setTimeout(() => {
        setConfirmState('idle');
      }, 3000);
    } else {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmState('idle');
      onEndCase();
    }
  };

  return (
    <motion.div
      key="assess"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {!closed ? (
        /* ── Before scoring ── */
        <>
          <textarea
            value={userNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Final assessment, diagnosis, disposition plan..."
            className="w-full text-sm border-b border-clinical-line py-3 px-1 focus:outline-none focus:border-clinical-teal transition-colors bg-transparent text-clinical-ink resize-none leading-relaxed placeholder-clinical-slate"
            rows={4}
          />

          <div className="flex justify-center pt-4">
            <button
              onClick={handleEndCaseClick}
              disabled={submitting}
              className={cn(
                "px-8 py-3 text-sm font-medium rounded-full disabled:opacity-50 transition-all",
                confirmState === 'confirming'
                  ? 'bg-clinical-red text-white glow-red'
                  : 'bg-clinical-teal text-white glow-green'
              )}
            >
              {submitting ? 'Scoring...' : confirmState === 'confirming' ? 'Confirm — End Case?' : 'End Case'}
            </button>
          </div>
        </>
      ) : (
        /* ── After scoring ── */
        <>
          {/* Hero: Score */}
          <div className="text-center pt-4">
            <p className={cn(
              'text-6xl font-bold font-mono',
              score >= 80 ? 'text-clinical-green' :
              score >= 60 ? 'text-clinical-ink' :
              'text-clinical-red'
            )}>
              {score}
            </p>
          </div>

          {/* #13: Simulation time */}
          <p className="text-xs text-clinical-slate text-center">
            Completed in {simTime} minutes
          </p>

          {/* Feedback */}
          {feedbackText && (
            <p className="text-sm text-clinical-ink-muted leading-relaxed text-center max-w-md mx-auto">
              {feedbackText}
            </p>
          )}

          {/* #8: Reasoning score breakdown */}
          {evaluation?.reasoningScore && (
            <div className="flex flex-wrap justify-center gap-4 text-xs text-clinical-slate">
              <span>Data: <span className="font-mono text-clinical-ink">{evaluation.reasoningScore.dataAcquisitionThoroughness}</span></span>
              <span>PR: <span className="font-mono text-clinical-ink">{evaluation.reasoningScore.problemRepresentation}</span></span>
              <span>DDx: <span className="font-mono text-clinical-ink">{evaluation.reasoningScore.differentialAccuracy}</span></span>
              <span>Plan: <span className="font-mono text-clinical-ink">{evaluation.reasoningScore.managementPlan}</span></span>
            </div>
          )}

          {/* Correct diagnosis */}
          {correctDx && (
            <p className="text-sm text-clinical-slate text-center">
              Diagnosis: <span className="font-medium text-clinical-ink">{correctDx}</span>
            </p>
          )}

          {/* Key actions */}
          {evaluation?.keyActions && evaluation.keyActions.length > 0 && (
            <ul className="space-y-1.5 max-w-md mx-auto">
              {evaluation.keyActions.map((action, i) => (
                <li key={i} className="text-sm text-clinical-ink-muted flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">{action.startsWith('✓') ? '•' : '×'}</span>
                  <span>{action.replace(/^[✓✗]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )}

          {/* #7: Clinical pearl */}
          {evaluation?.clinicalPearl && (
            <p className="text-sm text-clinical-slate italic text-center max-w-md mx-auto border-t border-clinical-line pt-6">
              {evaluation.clinicalPearl}
            </p>
          )}

          {/* New case button */}
          <div className="flex justify-center pt-6">
            <button
              onClick={onNewCase}
              className="px-8 py-3 bg-clinical-teal text-white text-sm font-medium rounded-full hover:opacity-90 transition-all glow-green"
            >
              New Case
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
