import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Lightbulb, Stethoscope, Brain, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MedicalCase, ClinicalFinding, DifferentialEntry } from '../../types';

interface DxPauseTabProps {
  medicalCase: MedicalCase;
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;
  differentials: DifferentialEntry[];
  findings: ClinicalFinding[];
  onProceedToManagement: () => void;
  simTime: number;
}

export function DxPauseTab({
  medicalCase, problemRepresentation, onProblemRepresentationChange,
  differentials, findings, onProceedToManagement, simTime,
}: DxPauseTabProps) {
  const [confirmed, setConfirmed] = useState(false);
  const leadDx = differentials.find(d => d.isLead);
  const hasMinimumData = differentials.length >= 1 && problemRepresentation.trim().length >= 20;

  const positiveFindings = findings.filter(f => f.relevance === 'positive');
  const negativeFindings = findings.filter(f => f.relevance === 'negative');

  return (
    <motion.div key="dxpause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      {/* Header */}
      <div className="panel border-t-4 border-t-teal-500">
        <div className="panel-header bg-teal-50/50">
          <span className="panel-title flex items-center gap-2 text-teal-700">
            <Brain className="w-4 h-4" />
            DxPause — Diagnostic Reflection
          </span>
          <span className="text-[10px] font-mono text-clinical-slate">T+{simTime}m</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2.5 bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-800">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
            <div>
              <strong className="block mb-1">Pause and reflect before proceeding to management.</strong>
              This is a structured checkpoint to consolidate your clinical reasoning. Review your findings,
              update your problem representation, and confirm your leading differential before treating.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Summary of reasoning so far */}
        <div className="space-y-4">
          {/* Findings summary */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Data Acquired</span>
              <span className="text-[10px] text-clinical-slate font-mono">{findings.length} findings</span>
            </div>
            <div className="p-4 space-y-3">
              {positiveFindings.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-green-700 uppercase mb-1.5">Pertinent Positives ({positiveFindings.length})</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {positiveFindings.map(f => (
                      <span key={f.id} className="px-2 py-1 bg-green-50 text-green-800 text-[10px] font-medium rounded-md border border-green-200">
                        {f.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {negativeFindings.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-red-600 uppercase mb-1.5">Pertinent Negatives ({negativeFindings.length})</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {negativeFindings.map(f => (
                      <span key={f.id} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-medium rounded-md border border-red-200">
                        {f.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {findings.length === 0 && (
                <p className="text-xs text-clinical-slate/50 italic">No findings tracked yet. Go back and examine the patient.</p>
              )}
            </div>
          </div>

          {/* Current differential */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Your Differential ({differentials.length})</span>
            </div>
            <div className="p-4">
              {differentials.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  You haven't built a differential yet. Use the Diagnosis Pad to add diagnoses.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {differentials.map((d, i) => (
                    <div key={d.id} className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                      d.isLead ? 'bg-teal-50 border border-teal-300 font-medium text-teal-800' : 'bg-clinical-bg/50 border border-clinical-line'
                    )}>
                      <span className="font-mono text-clinical-slate/50 w-4">{i + 1}.</span>
                      <span className="flex-1">{d.diagnosis}</span>
                      {d.isLead && (
                        <span className="text-[9px] font-bold uppercase bg-teal-600 text-white px-1.5 py-0.5 rounded">LEAD</span>
                      )}
                      <span className={cn(
                        'text-[10px] capitalize',
                        d.confidence === 'high' ? 'text-green-600' :
                        d.confidence === 'moderate' ? 'text-amber-600' :
                        'text-clinical-slate/60'
                      )}>{d.confidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Update PR and confirm */}
        <div className="space-y-4">
          <div className="panel border-teal-200">
            <div className="panel-header bg-teal-50/50">
              <span className="panel-title text-teal-700">Update Your Problem Representation</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[10px] text-clinical-slate">
                Based on all data collected so far, write a refined 1-2 sentence summary of the patient's presentation.
                This should include key demographics, timeline, and the most discriminating features.
              </p>
              <textarea
                value={problemRepresentation}
                onChange={(e) => onProblemRepresentationChange(e.target.value)}
                placeholder="A [age]-year-old [gender] with [PMH] presenting with [duration] of [symptoms], notable for [key findings], most consistent with [leading diagnosis]..."
                className="w-full h-36 bg-clinical-bg border border-clinical-line rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
                aria-label="Updated problem representation"
              />
            </div>
          </div>

          {/* Confirmation and proceed */}
          <div className="panel">
            <div className="p-4 space-y-4">
              {!hasMinimumData && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Before proceeding:</strong>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {differentials.length < 1 && <li>Add at least 1 differential diagnosis</li>}
                      {problemRepresentation.trim().length < 20 && <li>Write a problem representation (20+ chars)</li>}
                    </ul>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-clinical-line text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-clinical-ink leading-relaxed group-hover:text-teal-700 transition-colors">
                  I have reviewed my findings, updated my problem representation, and am ready to proceed to management.
                  {leadDx && <> My leading diagnosis is <strong className="text-teal-700">{leadDx.diagnosis}</strong>.</>}
                </span>
              </label>

              <button
                onClick={onProceedToManagement}
                disabled={!confirmed || !hasMinimumData}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-clinical-line disabled:text-clinical-slate/50 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Proceed to Management
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
