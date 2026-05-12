import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, Stethoscope, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import CaseExport from '../CaseExport';
import { CaseEvaluation, MedicalCase } from '../../types';

interface AssessmentTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  userNotes: string;
  /** CCS evaluation returned by /api/end-case */
  evaluation: CaseEvaluation | null;
  /** Legacy simple feedback (evaluate-diagnosis fallback) */
  feedback: { score: number; feedback: string } | null;
  submitting: boolean;
  logs: { time: string; text: string }[];
  onNotesChange: (val: string) => void;
  /** Separate scratchpad differential state */
  differential: string;
  onDifferentialChange: (val: string) => void;
  /** CCS: end case & score management */
  onEndCase: () => void;
  onNewCase: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const colour =
    score >= 80 ? 'var(--color-clinical-green)' :
    score >= 60 ? 'var(--color-clinical-blue)'  :
                  'var(--color-clinical-red)';
  return (
    <div className="w-20 h-20 rounded-full border-2 border-clinical-line flex items-center justify-center relative shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#E8ECF1" strokeWidth="4" />
        <circle cx="40" cy="40" r="34" fill="none" stroke={colour} strokeWidth="4"
          strokeDasharray={`${score * 2.136} 213.6`} strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold text-clinical-ink">{score}</span>
    </div>
  );
}

export function AssessmentTab({
  medicalCase, simTime, userNotes, evaluation, feedback,
  submitting, logs, onNotesChange, differential, onDifferentialChange, onEndCase, onNewCase,
}: AssessmentTabProps) {
  const closed    = !!(evaluation || feedback);
  const score     = evaluation?.score     ?? feedback?.score     ?? 0;
  const feedbackText = evaluation?.feedback ?? feedback?.feedback ?? '';
  const correctDx = evaluation?.correctDiagnosis ?? medicalCase.correctDiagnosis;

  return (
    <motion.div key="assess" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <Stethoscope className="w-3.5 h-3.5" /> Assessment &amp; Plan
          </span>
          {closed && (
            <span className="text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 px-2 py-0.5 rounded-full">
              CASE CLOSED
            </span>
          )}
        </div>

        <div className="p-5">
          {!closed ? (
            /* ── Active case ── */
            <div className="space-y-5">
              {/* CCS mode notice */}
              <div className="flex gap-2.5 bg-clinical-blue/5 border border-clinical-blue/20 rounded-lg p-4 text-xs text-clinical-blue">
                <Stethoscope className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>CCS Mode —</strong> scored on <strong>management quality</strong>, not just the diagnosis.
                  Order tests, advance time, treat the patient, then complete the case for feedback.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Scratch-pad differential */}
                <div>
                  <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">
                    Working Differential (scratch-pad)
                  </label>
                  <textarea
                    value={differential}
                    onChange={(e) => onDifferentialChange(e.target.value)}
                    placeholder={'1. Septic Shock\n2. PE\n3. Hypovolemic Shock'}
                    className="w-full h-20 bg-clinical-bg border border-clinical-line rounded-md p-3 text-xs font-mono focus:outline-none focus:border-clinical-blue/50 resize-none"
                  />
                </div>

                {/* Available results */}
                <div>
                  <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">
                    Results Now Available
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {medicalCase.labs
                      .filter((l) => l.availableAt !== undefined && l.availableAt <= simTime)
                      .map((l) => (
                        <span key={l.name}
                          className={cn(
                            'px-2 py-1 text-[10px] font-medium rounded-full flex items-center gap-1',
                            l.status === 'critical'
                              ? 'bg-clinical-red/8 text-clinical-red'
                              : l.status === 'abnormal'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-clinical-bg text-clinical-slate'
                          )}>
                          {l.status === 'critical' && <AlertTriangle className="w-2.5 h-2.5" />}
                          {l.name}: {l.value}
                        </span>
                      ))}
                    {medicalCase.imaging
                      .filter((i) => i.availableAt !== undefined && i.availableAt <= simTime)
                      .map((i) => (
                        <span key={i.type}
                          className="px-2 py-1 bg-clinical-blue/8 text-clinical-blue text-[10px] font-medium rounded-full">
                          {i.type} ✓
                        </span>
                      ))}
                    {medicalCase.labs.filter((l) => l.availableAt !== undefined && l.availableAt <= simTime).length === 0 &&
                      medicalCase.imaging.filter((i) => i.availableAt !== undefined && i.availableAt <= simTime).length === 0 && (
                        <span className="text-xs text-clinical-slate/50 italic">No results back yet — order tests &amp; advance time</span>
                      )}
                  </div>
                </div>
              </div>

              {/* Final notes + complete */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-clinical-line/50">
                <textarea
                  value={userNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Optional: final assessment, diagnosis thoughts, disposition plan..."
                  className="flex-1 h-16 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-clinical-blue/30 resize-none"
                />
                <button
                  onClick={onEndCase}
                  disabled={submitting}
                  className="sm:h-16 px-6 py-3 bg-clinical-blue hover:bg-clinical-blue/90 text-white rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0"
                >
                  {submitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />}
                  <span className="text-xs font-medium">Complete Case</span>
                </button>
              </div>
            </div>
          ) : (
            /* ── Post-case feedback ── */
            <div className="space-y-5 animate-in fade-in">

              {/* Score + summary */}
              <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                <ScoreRing score={score} />
                <div className="flex-1 text-center sm:text-left">
                  <h4 className={cn(
                    'text-xs font-semibold uppercase tracking-wide mb-2',
                    score >= 80 ? 'text-clinical-green' : score >= 60 ? 'text-clinical-blue' : 'text-clinical-red'
                  )}>
                    {score >= 80 ? '✓ Excellent Management' : score >= 60 ? 'Adequate — Room to Improve' : 'Review Required'}
                  </h4>
                  <div className="bg-clinical-bg p-4 rounded-lg border border-clinical-line text-sm text-clinical-ink leading-relaxed italic">
                    "{feedbackText}"
                  </div>
                  {correctDx && (
                    <p className="text-xs text-clinical-slate mt-2">
                      Diagnosis: <span className="font-semibold text-clinical-ink">{correctDx}</span>
                    </p>
                  )}
                  {evaluation?.explanation && (
                    <p className="text-xs text-clinical-slate/80 mt-1 leading-relaxed">{evaluation.explanation}</p>
                  )}
                </div>
              </div>

              {/* Score breakdown */}
              {evaluation?.breakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Initial Mgmt',   val: evaluation.breakdown.initialManagement,       max: 25 },
                    { label: 'Diagnostics',    val: evaluation.breakdown.diagnosticWorkup,         max: 25 },
                    { label: 'Treatment',      val: evaluation.breakdown.therapeuticInterventions, max: 30 },
                    { label: 'Outcome',        val: evaluation.breakdown.patientOutcome,           max: 20 },
                  ].map(({ label, val, max }) => (
                    <div key={label} className="bg-clinical-bg border border-clinical-line rounded-lg p-3 text-center">
                      <div className="text-[10px] text-clinical-slate uppercase mb-1">{label}</div>
                      <div className="text-lg font-bold text-clinical-ink">{val}</div>
                      <div className="text-[10px] text-clinical-slate/60">/ {max}</div>
                    </div>
                  ))}
                  {(evaluation.breakdown.efficiencyPenalty ?? 0) < 0 && (
                    <div className="col-span-2 sm:col-span-4 bg-clinical-red/5 border border-clinical-red/20 rounded-lg p-3 text-center">
                      <div className="text-[10px] text-clinical-red uppercase mb-1">Efficiency Penalty</div>
                      <div className="text-lg font-bold text-clinical-red">{evaluation.breakdown.efficiencyPenalty}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Key actions */}
              {evaluation?.keyActions && evaluation.keyActions.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-clinical-slate uppercase mb-2">Key Actions</h5>
                  <ul className="space-y-1">
                    {evaluation.keyActions.map((a, i) => (
                      <li key={i} className={cn(
                        'text-xs flex items-start gap-2 px-3 py-1.5 rounded-md',
                        a.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      )}>
                        {a.startsWith('✓')
                          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          : <XCircle      className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                        {a.replace(/^[✓✗]\s*/, '')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Critical missed */}
              {evaluation?.criticalMissed && evaluation.criticalMissed.length > 0 && (
                <div className="bg-clinical-red/5 border border-clinical-red/20 rounded-lg p-4">
                  <h5 className="text-[10px] font-semibold text-clinical-red uppercase mb-2">Critical Missed / Delayed</h5>
                  <ul className="space-y-1">
                    {evaluation.criticalMissed.map((m, i) => (
                      <li key={i} className="text-xs text-clinical-red flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clinical pearl */}
              {evaluation?.clinicalPearl && (
                <div className="flex gap-3 bg-clinical-blue/5 border border-clinical-blue/20 rounded-lg p-4">
                  <Lightbulb className="w-4 h-4 text-clinical-blue shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-semibold text-clinical-blue uppercase mb-1">Clinical Pearl</div>
                    <p className="text-xs text-clinical-ink">{evaluation.clinicalPearl}</p>
                  </div>
                </div>
              )}

              {/* Action audit */}
              {(medicalCase.clinicalActions || []).length > 0 && (
                <div className="border-t border-clinical-line/50 pt-4">
                  <h5 className="text-[10px] font-medium text-clinical-slate uppercase mb-3">Full Action Audit</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {medicalCase.clinicalActions.map((a, i) => (
                      <div key={i}
                        className="flex gap-2 text-xs bg-clinical-bg/50 p-2 rounded-md border border-clinical-line/50">
                        <span className="font-mono text-clinical-blue shrink-0">T+{a.timestamp}</span>
                        <span className="text-clinical-ink truncate">{a.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center items-center gap-3 pt-3">
                <button onClick={onNewCase}
                  className="px-8 py-2.5 bg-clinical-blue text-white rounded-lg font-medium text-sm hover:bg-clinical-blue/90 transition-all">
                  Next Patient
                </button>
                <CaseExport medicalCase={medicalCase}
                  feedback={{ score, feedback: feedbackText }} logs={logs} />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
