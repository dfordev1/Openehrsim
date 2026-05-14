import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  PenTool,
  Star,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type {
  DifferentialEntry,
  ClinicalFinding,
  PRSnapshot,
  WorkflowStage,
} from '../types';
import { STAGE_LABELS, STAGE_REQUIREMENTS } from '../hooks/useClinicalReasoning';

interface StageCommitGateProps {
  /** The stage the learner is *leaving*. The modal shows the requirements
   *  the learner must satisfy before they can transition to nextStage. */
  fromStage: WorkflowStage;
  /** The stage they are trying to advance to. */
  toStage: WorkflowStage;

  // ── current reasoning state (working draft) ───────────────────────────
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;
  differentials: DifferentialEntry[];
  onSetLead: (id: string) => void;
  findings: ClinicalFinding[];

  /** Snapshot of the PR at the prior gate, if any. Used for a brief
   *  "since last stage" diff cue. */
  previousPrSnapshot?: PRSnapshot;

  /** Commit and advance. Returns snapshot id if successful, else null. */
  onCommit: (stage: WorkflowStage) => string | null;
  /** User dismissed the gate without advancing. */
  onCancel: () => void;
  /** Computed list of unmet requirements for the *fromStage* gate. */
  unmetRequirements: string[];

  isOpen: boolean;
}

export function StageCommitGate({
  fromStage,
  toStage,
  problemRepresentation,
  onProblemRepresentationChange,
  differentials,
  onSetLead,
  findings,
  previousPrSnapshot,
  onCommit,
  onCancel,
  unmetRequirements,
  isOpen,
}: StageCommitGateProps) {
  const req = STAGE_REQUIREMENTS[fromStage];
  const canCommit = unmetRequirements.length === 0;

  // Live requirement progress for a richer checklist than the raw strings.
  const prLen = problemRepresentation.trim().length;
  const lead = differentials.find(d => d.isLead);
  const linkedFindingCount = useMemo(
    () =>
      findings.filter(
        f => f.relevanceByDx && Object.keys(f.relevanceByDx).length > 0,
      ).length,
    [findings],
  );

  const checklist = useMemo(
    () => [
      {
        label: `Problem representation (≥ ${req.minPrLength} chars)`,
        value: `${prLen} / ${req.minPrLength}`,
        ok: prLen >= req.minPrLength,
      },
      {
        label: `Differential diagnoses (≥ ${req.minDifferentials})`,
        value: `${differentials.length} / ${req.minDifferentials}`,
        ok: differentials.length >= req.minDifferentials,
      },
      ...(req.requiresLead
        ? [
            {
              label: 'Lead (working) diagnosis selected',
              value: lead ? lead.diagnosis : 'none',
              ok: !!lead,
            },
          ]
        : []),
      ...(req.requiresFindingsLinked
        ? [
            {
              label: 'At least one finding linked to a differential',
              value: `${linkedFindingCount} linked`,
              ok: linkedFindingCount >= 1,
            },
          ]
        : []),
    ],
    [prLen, req, differentials, lead, linkedFindingCount],
  );

  // Close on Escape when it is open.
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onCancel]);

  const [localPr, setLocalPr] = useState(problemRepresentation);
  useEffect(() => setLocalPr(problemRepresentation), [problemRepresentation, isOpen]);

  function handleCommit() {
    onProblemRepresentationChange(localPr);
    // Defer to next tick so the parent has the latest PR when commit runs.
    setTimeout(() => onCommit(fromStage), 0);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-clinical-teal/50 backdrop-blur-sm z-[150]"
            aria-hidden="true"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Commit reasoning before advancing to ${STAGE_LABELS[toStage]}`}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] bg-clinical-surface border border-clinical-line rounded-xl shadow-2xl z-[151] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-clinical-teal text-white px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Lightbulb className="w-4 h-4" />
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Commit your reasoning
                  </h3>
                  <p className="text-[10px] text-white/70">
                    Before advancing from {STAGE_LABELS[fromStage]} → {STAGE_LABELS[toStage]}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 hover:bg-clinical-surface/10 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Requirements checklist */}
              <section>
                <label className="text-[10px] font-bold text-clinical-slate uppercase tracking-wide mb-2 block">
                  Stage Requirements
                </label>
                <ul className="space-y-1.5">
                  {checklist.map((c, i) => (
                    <li
                      key={i}
                      className={cn(
                        'flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border',
                        c.ok
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700',
                      )}
                    >
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="flex-1">{c.label}</span>
                      <span className="font-mono text-[10px] opacity-70">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* PR editor */}
              <section>
                <label className="text-[10px] font-bold text-clinical-ink uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <PenTool className="w-3 h-3" />
                  Problem Representation
                  <span className="ml-1 text-clinical-slate font-normal normal-case">
                    — update with what you've learned during {STAGE_LABELS[fromStage]}
                  </span>
                </label>
                {previousPrSnapshot && (
                  <details className="mb-2 text-[10px] text-clinical-slate">
                    <summary className="cursor-pointer hover:text-clinical-ink">
                      Previous snapshot from {STAGE_LABELS[previousPrSnapshot.stage]} (T+{previousPrSnapshot.simTime}m)
                    </summary>
                    <div className="mt-1.5 p-2.5 bg-clinical-line/50 border border-clinical-line rounded text-clinical-ink italic">
                      "{previousPrSnapshot.text}"
                    </div>
                  </details>
                )}
                <textarea
                  value={localPr}
                  onChange={e => setLocalPr(e.target.value)}
                  placeholder="A [age]-year-old [gender] with [PMH] presenting with [duration] of [symptoms], notable for [key findings], concerning for [suspected diagnoses]..."
                  className="w-full h-28 bg-clinical-line/50 border border-clinical-line rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/30 resize-none"
                  aria-label="Problem representation"
                />
                <div className="text-[10px] text-clinical-slate text-right mt-1">
                  {localPr.trim().length} / {req.minPrLength} required
                </div>
              </section>

              {/* Lead chooser — only when required */}
              {req.requiresLead && differentials.length > 0 && (
                <section>
                  <label className="text-[10px] font-bold text-clinical-slate uppercase tracking-wide mb-2 block">
                    Commit to a Lead Diagnosis
                  </label>
                  <div className="space-y-1.5">
                    {differentials.map(d => (
                      <button
                        key={d.id}
                        onClick={() => onSetLead(d.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all',
                          d.isLead
                            ? 'bg-clinical-line border-clinical-line ring-1 ring-clinical-teal/30 text-clinical-ink font-medium'
                            : 'bg-clinical-line/50 border-clinical-line hover:border-clinical-line',
                        )}
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5 shrink-0',
                            d.isLead ? 'text-clinical-ink fill-current' : 'text-clinical-slate/50',
                          )}
                        />
                        <span className="flex-1">{d.diagnosis}</span>
                        <span
                          className={cn(
                            'text-[10px] capitalize',
                            d.confidence === 'high'
                              ? 'text-green-600'
                              : d.confidence === 'moderate'
                              ? 'text-amber-600'
                              : 'text-clinical-slate',
                          )}
                        >
                          {d.confidence}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Summary of what's about to be committed */}
              <section className="bg-clinical-line border border-clinical-line rounded-lg p-3 text-xs text-clinical-ink">
                <p className="text-[10px] font-semibold text-clinical-ink uppercase mb-1">
                  Committing this snapshot will:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-clinical-slate">
                  <li>Record your problem representation as v{/* future-ordering */}{'X'} for this case</li>
                  <li>Save your current differential ({differentials.length} dx) as the state at {STAGE_LABELS[fromStage]}</li>
                  {lead && <li>Flag <strong className="text-clinical-ink">{lead.diagnosis}</strong> as your working lead</li>}
                  <li>Unlock navigation to {STAGE_LABELS[toStage]}</li>
                </ul>
              </section>
            </div>

            {/* Footer */}
            <div className="bg-clinical-line/50 border-t border-clinical-line px-5 py-3 flex items-center gap-3 shrink-0">
              <button
                onClick={onCancel}
                className="text-xs font-medium text-clinical-slate hover:text-clinical-ink transition-colors"
              >
                Keep working on {STAGE_LABELS[fromStage]}
              </button>
              <button
                onClick={handleCommit}
                disabled={!canCommit || localPr.trim().length < req.minPrLength}
                className="ml-auto flex items-center gap-2 bg-clinical-teal hover:bg-clinical-teal disabled:bg-clinical-line disabled:text-clinical-slate text-white text-xs font-medium px-4 py-2 rounded-lg transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Commit &amp; advance to {STAGE_LABELS[toStage]}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
