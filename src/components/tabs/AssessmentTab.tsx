import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { CaseEvaluation, MedicalCase } from '../../types';

interface AssessmentTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  userNotes: string;
  evaluation: CaseEvaluation | null;
  feedback: { score: number; feedback: string } | null;
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
  feedback,
  submitting,
  logs,
  onNotesChange,
  differential,
  onDifferentialChange,
  onEndCase,
  onNewCase,
}: AssessmentTabProps) {
  const closed = !!(evaluation || feedback);
  const score = evaluation?.score ?? feedback?.score ?? 0;
  const feedbackText = evaluation?.feedback ?? feedback?.feedback ?? '';
  const correctDx = evaluation?.correctDiagnosis ?? medicalCase.correctDiagnosis;

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
            className="w-full text-sm border-b border-gray-200 py-3 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent resize-none leading-relaxed"
            rows={4}
          />

          <div className="flex justify-center pt-4">
            <button
              onClick={onEndCase}
              disabled={submitting}
              className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-50 transition-opacity"
            >
              {submitting ? 'Scoring...' : 'End Case'}
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
              score >= 80 ? 'text-green-600' :
              score >= 60 ? 'text-gray-900' :
              'text-red-600'
            )}>
              {score}
            </p>
          </div>

          {/* Feedback */}
          {feedbackText && (
            <p className="text-sm text-gray-600 leading-relaxed text-center max-w-md mx-auto">
              {feedbackText}
            </p>
          )}

          {/* Correct diagnosis */}
          {correctDx && (
            <p className="text-sm text-gray-400 text-center">
              Diagnosis: <span className="font-medium text-gray-900">{correctDx}</span>
            </p>
          )}

          {/* Key actions */}
          {evaluation?.keyActions && evaluation.keyActions.length > 0 && (
            <ul className="space-y-1.5 max-w-md mx-auto">
              {evaluation.keyActions.map((action, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">{action.startsWith('✓') ? '•' : '×'}</span>
                  <span>{action.replace(/^[✓✗]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )}

          {/* New case button */}
          <div className="flex justify-center pt-6">
            <button
              onClick={onNewCase}
              className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              New Case
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
