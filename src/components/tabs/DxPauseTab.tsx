import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Grid3x3,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ClinicalFinding,
  DifferentialEntry,
  MedicalCase,
  IllnessScript,
  PRSnapshot,
} from '../../types';
import { FindingsMatrix } from '../FindingsMatrix';
import { ReasoningTimeline } from '../ReasoningTimeline';
import { STAGE_REQUIREMENTS } from '../../hooks/useClinicalReasoning';

interface DxPauseTabProps {
  medicalCase: MedicalCase;
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;
  differentials: DifferentialEntry[];
  findings: ClinicalFinding[];
  prHistory: PRSnapshot[];
  prIsDirty: boolean;
  onUpdateFindingRelevanceForDx: (
    findingId: string,
    differentialId: string,
    relevance: 'positive' | 'negative' | 'none',
  ) => void;
  onSetIllnessScript: (id: string, script: IllnessScript) => void;
  onSetLead: (id: string) => void;
  onProceedToManagement: () => void;
  simTime: number;
}

/** Compute a rough narrowing score: we want breadth at triage/history (3+)
 *  and convergence at dxpause (≤3 strong candidates + a lead). */
function narrowingVerdict(
  count: number,
): { label: string; tone: 'ok' | 'broad' | 'narrow' } {
  if (count <= 1) return { label: 'Too narrow', tone: 'narrow' };
  if (count >= 6) return { label: 'Consider pruning', tone: 'broad' };
  return { label: 'Reasonable', tone: 'ok' };
}

export function DxPauseTab({
  medicalCase,
  problemRepresentation,
  onProblemRepresentationChange,
  differentials,
  findings,
  prHistory,
  prIsDirty,
  onUpdateFindingRelevanceForDx,
  onSetIllnessScript,
  onSetLead,
  onProceedToManagement,
  simTime,
}: DxPauseTabProps) {
  const [confirmed, setConfirmed] = useState(false);
  const req = STAGE_REQUIREMENTS.dxpause;

  const leadDx = differentials.find(d => d.isLead);
  const verdict = narrowingVerdict(differentials.length);

  // Per-dx tally: how many pertinent positives / negatives is each carrying?
  const dxScores = useMemo(() => {
    const scores: Record<string, { pos: number; neg: number }> = {};
    differentials.forEach(d => (scores[d.id] = { pos: 0, neg: 0 }));
    findings.forEach(f => {
      if (!f.relevanceByDx) return;
      for (const [dxId, r] of Object.entries(f.relevanceByDx)) {
        if (!scores[dxId]) continue;
        if (r === 'positive') scores[dxId].pos += 1;
        if (r === 'negative') scores[dxId].neg += 1;
      }
    });
    return scores;
  }, [findings, differentials]);

  const linkedFindingCount = useMemo(
    () =>
      findings.filter(
        f => f.relevanceByDx && Object.keys(f.relevanceByDx).length > 0,
      ).length,
    [findings],
  );

  // Gate summary
  const prLen = problemRepresentation.trim().length;
  const checklist = [
    {
      label: `Problem representation (≥ ${req.minPrLength} chars)`,
      value: `${prLen} / ${req.minPrLength}`,
      ok: prLen >= req.minPrLength,
    },
    {
      label: `At least ${req.minDifferentials} differentials`,
      value: `${differentials.length}`,
      ok: differentials.length >= req.minDifferentials,
    },
    {
      label: 'Lead diagnosis selected',
      value: leadDx ? leadDx.diagnosis : 'none',
      ok: !!leadDx,
    },
    {
      label: 'At least 1 finding linked to a differential',
      value: `${linkedFindingCount} linked`,
      ok: linkedFindingCount >= 1,
    },
  ];
  const allPassed = checklist.every(c => c.ok);
  const hasMinimumData = allPassed;

  const positiveFindings = findings.filter(f => f.relevance === 'positive');
  const negativeFindings = findings.filter(f => f.relevance === 'negative');

  return (
    <motion.div
      key="dxpause"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="panel border-t-4 border-t-teal-500">
        <div className="panel-header bg-teal-50/50">
          <span className="panel-title flex items-center gap-2 text-teal-700">
            <Brain className="w-4 h-4" />
            DxPause — Diagnostic Reflection
          </span>
          <span className="text-[10px] font-mono text-clinical-slate">
            T+{simTime}m
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2.5 bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-800">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
            <div>
              <strong className="block mb-1">
                Pause and reflect before proceeding to management.
              </strong>
              This is a structured checkpoint. Refine your problem
              representation with all the data you've gathered, narrow your
              differential to 2-4 strong candidates, commit to a lead, and
              make sure key findings have been linked to the diagnoses they
              support or refute.
            </div>
          </div>
        </div>
      </div>

      {/* Broad → narrow pressure strip */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Diagnostic Convergence</span>
          <span
            className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
              verdict.tone === 'ok'
                ? 'text-green-700 bg-green-50 border border-green-200'
                : verdict.tone === 'broad'
                ? 'text-amber-700 bg-amber-50 border border-amber-200'
                : 'text-red-700 bg-red-50 border border-red-200',
            )}
          >
            {verdict.tone === 'broad' ? (
              <TrendingUp className="w-3 h-3" />
            ) : verdict.tone === 'narrow' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {verdict.label}
          </span>
        </div>
        <div className="p-4">
          <div className="space-y-1.5">
            {differentials.length === 0 ? (
              <p className="text-xs text-clinical-slate/60 italic">
                No differentials to converge. Open the Dx Pad and start with
                a broad list (3-5), then prune here.
              </p>
            ) : (
              differentials.map((d, idx) => {
                const s = dxScores[d.id] ?? { pos: 0, neg: 0 };
                return (
                  <button
                    key={d.id}
                    onClick={() => onSetLead(d.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all',
                      d.isLead
                        ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-300 text-teal-800 font-medium'
                        : 'bg-clinical-bg/50 border-clinical-line hover:border-teal-300',
                    )}
                  >
                    <span className="font-mono text-clinical-slate/50 w-4">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 truncate">{d.diagnosis}</span>
                    <span className="text-[10px] font-mono">
                      <span className="text-green-600">+{s.pos}</span>
                      <span className="text-clinical-slate/40 mx-0.5">/</span>
                      <span className="text-red-600">−{s.neg}</span>
                    </span>
                    <span
                      className={cn(
                        'text-[10px] capitalize',
                        d.confidence === 'high'
                          ? 'text-green-600'
                          : d.confidence === 'moderate'
                          ? 'text-amber-600'
                          : 'text-clinical-slate/60',
                      )}
                    >
                      {d.confidence}
                    </span>
                    {d.isLead && (
                      <span className="text-[9px] font-bold uppercase bg-teal-600 text-white px-1.5 py-0.5 rounded">
                        LEAD
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Refined PR + Timeline */}
        <div className="space-y-4">
          <div className="panel border-teal-200">
            <div className="panel-header bg-teal-50/50">
              <span className="panel-title text-teal-700">
                Refine Your Problem Representation
              </span>
              {prIsDirty && prHistory.length > 0 && (
                <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  Uncommitted
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[10px] text-clinical-slate">
                This version should be richer than the one you wrote at
                triage — include the discriminating features and the lead
                diagnosis you're converging on.
              </p>
              <textarea
                value={problemRepresentation}
                onChange={e => onProblemRepresentationChange(e.target.value)}
                placeholder="A [age]-year-old [gender] with [PMH] presenting with [duration] of [symptoms], notable for [key findings], most consistent with [leading diagnosis]..."
                className="w-full h-32 bg-clinical-bg border border-clinical-line rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
                aria-label="Updated problem representation"
              />
              <div className="text-[10px] text-clinical-slate/60 text-right">
                {prLen} / {req.minPrLength} required
              </div>
            </div>
          </div>

          {/* Timeline of committed PRs */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">PR Evolution</span>
              <span className="text-[10px] text-clinical-slate/60">
                {prHistory.length} snapshot{prHistory.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="p-4">
              <ReasoningTimeline
                prHistory={prHistory}
                currentDraft={problemRepresentation}
                currentStage="dxpause"
                isDirty={prIsDirty}
              />
            </div>
          </div>
        </div>

        {/* Right: Findings summary + matrix */}
        <div className="space-y-4">
          {/* Findings summary */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Data Acquired</span>
              <span className="text-[10px] text-clinical-slate font-mono">
                {findings.length} findings
              </span>
            </div>
            <div className="p-4 space-y-3">
              {positiveFindings.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-green-700 uppercase mb-1.5">
                    Pertinent Positives ({positiveFindings.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {positiveFindings.map(f => (
                      <span
                        key={f.id}
                        className="px-2 py-1 bg-green-50 text-green-800 text-[10px] font-medium rounded-md border border-green-200"
                      >
                        {f.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {negativeFindings.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-red-600 uppercase mb-1.5">
                    Pertinent Negatives ({negativeFindings.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {negativeFindings.map(f => (
                      <span
                        key={f.id}
                        className="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-medium rounded-md border border-red-200"
                      >
                        {f.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {findings.length === 0 && (
                <p className="text-xs text-clinical-slate/50 italic">
                  No findings tracked yet. Go back and examine the patient.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Findings × Differentials matrix */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <Grid3x3 className="w-3.5 h-3.5" />
            Findings × Differentials
          </span>
          <span className="text-[10px] text-clinical-slate/60">
            Click a cell to mark pertinent + / −
          </span>
        </div>
        <div className="p-4">
          <FindingsMatrix
            findings={findings}
            differentials={differentials}
            onUpdateCell={onUpdateFindingRelevanceForDx}
          />
        </div>
      </div>

      {/* Gate checklist + proceed */}
      <div className="panel">
        <div className="p-4 space-y-4">
          <div>
            <h5 className="text-[10px] font-semibold text-clinical-slate uppercase mb-2">
              Stage Requirements
            </h5>
            <ul className="space-y-1">
              {checklist.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border',
                    c.ok
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800',
                  )}
                >
                  {c.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="flex-1">{c.label}</span>
                  <span className="font-mono text-[10px] opacity-70">
                    {c.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              disabled={!allPassed}
              className="mt-0.5 w-4 h-4 rounded border-clinical-line text-teal-600 focus:ring-teal-500 disabled:opacity-40"
            />
            <span
              className={cn(
                'text-xs leading-relaxed transition-colors',
                allPassed ? 'text-clinical-ink group-hover:text-teal-700' : 'text-clinical-slate/60',
              )}
            >
              I have reviewed my findings, updated my problem representation,
              linked findings to specific differentials, and am ready to
              proceed to management.
              {leadDx && (
                <>
                  {' '}My leading diagnosis is{' '}
                  <strong className="text-teal-700">{leadDx.diagnosis}</strong>.
                </>
              )}
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
    </motion.div>
  );
}
