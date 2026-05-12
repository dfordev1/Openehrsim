import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Loader2, Stethoscope } from 'lucide-react';
import { cn } from '../../lib/utils';
import CaseExport from '../CaseExport';
import { MedicalCase } from '../../types';

interface AssessmentTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  userDiagnosis: string;
  feedback: { score: number; feedback: string } | null;
  submitting: boolean;
  logs: { time: string; text: string }[];
  onDiagnosisChange: (val: string) => void;
  onSubmit: () => void;
  onNewCase: () => void;
}

export function AssessmentTab({
  medicalCase,
  simTime,
  userDiagnosis,
  feedback,
  submitting,
  logs,
  onDiagnosisChange,
  onSubmit,
  onNewCase,
}: AssessmentTabProps) {
  return (
    <motion.div key="assess" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <Stethoscope className="w-3.5 h-3.5" /> Assessment & Plan
          </span>
          {feedback && (
            <span className="text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 px-2 py-0.5 rounded-full">
              CASE CLOSED
            </span>
          )}
        </div>
        <div className="p-5">
          {!feedback ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Working differential */}
                <div>
                  <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">
                    Working Differential
                  </label>
                  <textarea
                    placeholder={'1. Septic Shock\n2. PE\n3. Hypovolemic Shock'}
                    className="w-full h-20 bg-clinical-bg border border-clinical-line rounded-md p-3 text-xs font-mono focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 resize-none"
                  />
                </div>

                {/* Confirmatory findings */}
                <div>
                  <label className="text-[10px] font-medium text-clinical-slate uppercase mb-2 block">
                    Confirmatory Findings
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {medicalCase.labs
                      .filter((l) => l.status === 'critical')
                      .map((l) => (
                        <span
                          key={l.name}
                          className="px-2 py-1 bg-clinical-red/8 text-clinical-red text-[10px] font-medium rounded-full flex items-center gap-1"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" /> {l.name}: {l.value}
                        </span>
                      ))}
                    {medicalCase.imaging
                      .filter((i) => i.availableAt && i.availableAt <= simTime)
                      .map((i) => (
                        <span
                          key={i.type}
                          className="px-2 py-1 bg-clinical-blue/8 text-clinical-blue text-[10px] font-medium rounded-full"
                        >
                          {i.type}
                        </span>
                      ))}
                    {medicalCase.labs.filter((l) => l.status === 'critical').length === 0 &&
                      medicalCase.imaging.filter((i) => i.availableAt && i.availableAt <= simTime).length === 0 && (
                        <span className="text-xs text-clinical-slate/50 italic">No critical findings yet</span>
                      )}
                  </div>
                </div>
              </div>

              {/* Diagnosis submit */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-clinical-line/50">
                <textarea
                  value={userDiagnosis}
                  onChange={(e) => onDiagnosisChange(e.target.value)}
                  placeholder="Enter final working diagnosis and disposition plan..."
                  className="flex-1 h-16 bg-clinical-bg border border-clinical-line rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-clinical-blue/30 transition-all resize-none"
                />
                <button
                  onClick={onSubmit}
                  disabled={submitting || !userDiagnosis}
                  className="sm:h-16 px-6 py-3 bg-clinical-blue hover:bg-clinical-blue/90 text-white rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span className="text-xs font-medium">Submit</span>
                </button>
              </div>
            </div>
          ) : (
            /* Feedback view */
            <div className="space-y-5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                {/* Score ring */}
                <div className="w-16 h-16 rounded-full border-2 border-clinical-line flex items-center justify-center relative shrink-0">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#E8ECF1" strokeWidth="3" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="var(--color-clinical-blue)"
                      strokeWidth="3"
                      strokeDasharray={`${feedback.score * 1.76} 176`}
                    />
                  </svg>
                  <span className="text-lg font-semibold text-clinical-ink">{feedback.score}</span>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-xs font-semibold text-clinical-blue uppercase tracking-wide mb-2">
                    {feedback.score >= 80 ? 'Success' : 'Review Required'}
                  </h4>
                  <div className="bg-clinical-bg p-4 rounded-lg border border-clinical-line text-sm text-clinical-ink leading-relaxed italic">
                    "{feedback.feedback}"
                  </div>
                  <p className="text-xs text-clinical-slate mt-3">
                    Correct Diagnosis:{' '}
                    <span className="font-medium text-clinical-ink">{medicalCase.correctDiagnosis}</span>
                  </p>
                </div>
              </div>

              {/* Action audit */}
              {(medicalCase.clinicalActions || []).length > 0 && (
                <div className="border-t border-clinical-line/50 pt-4">
                  <h5 className="text-[10px] font-medium text-clinical-slate uppercase mb-3">Action Audit</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {medicalCase.clinicalActions.map((action, i) => (
                      <div
                        key={i}
                        className="flex gap-2 text-xs bg-clinical-bg/50 p-2 rounded-md border border-clinical-line/50"
                      >
                        <span className="font-mono text-clinical-blue shrink-0">T+{action.timestamp}</span>
                        <span className="text-clinical-ink truncate">{action.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center items-center gap-3 pt-3">
                <button
                  onClick={onNewCase}
                  className="px-8 py-2.5 bg-clinical-blue text-white rounded-lg font-medium text-sm hover:bg-clinical-blue/90 transition-all"
                >
                  Next Patient
                </button>
                <CaseExport medicalCase={medicalCase} feedback={feedback} logs={logs} />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
