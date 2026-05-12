import { motion } from 'motion/react';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ClinicalFinding } from '../types';

interface ExpertFinding {
  text: string;
  stage: 'triage' | 'history' | 'exam' | 'diagnostics';
}

interface ExpertFeedbackProps {
  isOpen: boolean;
  onClose: () => void;
  // Expert data
  expertFindings: ExpertFinding[];
  expertDiseases: string[];
  // Learner data
  learnerFindings: ClinicalFinding[];
  learnerDifferentials: string[];
}

export function ExpertFeedback({
  isOpen, onClose,
  expertFindings, expertDiseases,
  learnerFindings, learnerDifferentials,
}: ExpertFeedbackProps) {
  if (!isOpen) return null;

  // Calculate matches
  const learnerFindingTexts = new Set(learnerFindings.map(f => f.text.toLowerCase()));
  const matchedFindings = expertFindings.filter(ef =>
    learnerFindingTexts.has(ef.text.toLowerCase())
  );
  const missedFindings = expertFindings.filter(ef =>
    !learnerFindingTexts.has(ef.text.toLowerCase())
  );

  const matchedDiseases = expertDiseases.filter(d =>
    learnerDifferentials.some(ld => ld.toLowerCase() === d.toLowerCase())
  );
  const missedDiseases = expertDiseases.filter(d =>
    !learnerDifferentials.some(ld => ld.toLowerCase() === d.toLowerCase())
  );

  const thoroughness = expertFindings.length > 0
    ? Math.round((matchedFindings.length / expertFindings.length) * 100)
    : 0;

  const efficiency = learnerFindings.length > 0
    ? Math.round((matchedFindings.length / learnerFindings.length) * 100)
    : 0;

  // Group expert findings by stage
  const groupedFindings = ['triage', 'history', 'exam', 'diagnostics'].map(stage => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    findings: expertFindings.filter(f => f.stage === stage),
  })).filter(g => g.findings.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-clinical-ink/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-clinical-line shrink-0">
          <h2 className="text-base font-bold text-clinical-ink">FEEDBACK: THE EXPERT VS YOU</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-clinical-bg rounded-md">
            <X className="w-4 h-4 text-clinical-slate" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 min-h-0">
            {/* Left column - Data Acquisition (3/5 width) */}
            <div className="md:col-span-3 border-r border-clinical-line p-5 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
                <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wide">Data Acquisition</h3>
              </div>

              {groupedFindings.map(group => (
                <div key={group.stage} className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-clinical-slate uppercase tracking-wide border-b border-clinical-line/50 pb-1">
                    {group.stage}
                  </h4>
                  {group.findings.map((ef, i) => {
                    const isMatched = learnerFindingTexts.has(ef.text.toLowerCase());
                    return (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs">
                        {isMatched ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <span className={cn('flex-1', isMatched ? 'text-clinical-ink' : 'text-clinical-slate')}>
                          {ef.text}
                        </span>
                        <span className={cn(
                          'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                          isMatched ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        )}>
                          {isMatched ? 'MATCHED' : 'MISSED'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Metrics */}
              <div className="space-y-3 pt-3 border-t border-clinical-line">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-clinical-slate uppercase">
                      Data Acquisition Efficiency
                    </span>
                    <span className="text-xs font-bold text-clinical-ink">{efficiency}%</span>
                  </div>
                  <div className="h-2 bg-clinical-line rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${efficiency}%` }} />
                  </div>
                  <p className="text-[9px] text-clinical-slate/60 mt-0.5">
                    {matchedFindings.length}/{learnerFindings.length} of your findings matched the expert
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-clinical-slate uppercase">
                      Data Acquisition Thoroughness
                    </span>
                    <span className="text-xs font-bold text-clinical-ink">{thoroughness}%</span>
                  </div>
                  <div className="h-2 bg-clinical-line rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${thoroughness}%` }} />
                  </div>
                  <p className="text-[9px] text-clinical-slate/60 mt-0.5">
                    {matchedFindings.length}/{expertFindings.length} expert findings were captured
                  </p>
                </div>
              </div>
            </div>

            {/* Right column - Top 3 Diseases (2/5 width) */}
            <div className="md:col-span-2 p-5 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
                <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wide">Top 3 Diseases</h3>
              </div>

              <div className="space-y-2">
                {expertDiseases.map((disease, i) => {
                  const isMatched = learnerDifferentials.some(
                    ld => ld.toLowerCase() === disease.toLowerCase()
                  );
                  return (
                    <div key={i} className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border',
                      isMatched ? 'bg-green-50 border-green-200' : 'bg-red-50/50 border-red-200'
                    )}>
                      {isMatched ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span className="flex-1 text-xs font-medium text-clinical-ink">{disease}</span>
                      <span className={cn(
                        'text-[9px] font-bold uppercase',
                        isMatched ? 'text-green-700' : 'text-red-600'
                      )}>
                        {isMatched ? 'MATCHED' : 'MISSED'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Learner's extra diagnoses */}
              {learnerDifferentials.filter(ld =>
                !expertDiseases.some(ed => ed.toLowerCase() === ld.toLowerCase())
              ).length > 0 && (
                <div className="space-y-2 pt-3 border-t border-clinical-line/50">
                  <h4 className="text-[10px] font-semibold text-clinical-slate uppercase">Your other diagnoses</h4>
                  {learnerDifferentials
                    .filter(ld => !expertDiseases.some(ed => ed.toLowerCase() === ld.toLowerCase()))
                    .map((ld, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-clinical-bg/50 border border-clinical-line rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 text-clinical-slate/50 shrink-0" />
                        <span className="text-xs text-clinical-slate">{ld}</span>
                        <span className="text-[9px] text-clinical-slate/60 ml-auto">NOT SELECTED BY EXPERT</span>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Key */}
              <div className="bg-clinical-bg/50 border border-clinical-line rounded-lg p-3 space-y-1.5">
                <span className="text-[9px] font-bold text-clinical-slate uppercase">KEY:</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  <span className="text-green-700">MATCHED</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <XCircle className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">MISSED</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <AlertCircle className="w-3 h-3 text-clinical-slate/50" />
                  <span className="text-clinical-slate/60">NOT SELECTED BY EXPERT</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clinical-line shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-clinical-ink text-white rounded-lg font-medium text-xs hover:bg-clinical-slate transition-all"
          >
            Close Feedback
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
