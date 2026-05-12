import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, FileText, GitCommit, Pencil, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PRSnapshot, WorkflowStage } from '../types';
import { STAGE_LABELS } from '../hooks/useClinicalReasoning';

interface ReasoningTimelineProps {
  /** Committed PR snapshots, oldest → newest. */
  prHistory: PRSnapshot[];
  /** The learner's current working PR (not yet committed). */
  currentDraft: string;
  /** The stage the learner is on right now. */
  currentStage: WorkflowStage;
  /** Is the draft different from the latest snapshot? */
  isDirty: boolean;
}

/** Compute a simple token diff between two PR strings for the "what
 *  changed" summary. Returns added / removed token counts only — a full
 *  word-level diff would be overkill for 1-3 sentence PRs. */
function diffSummary(prev: string, next: string): { added: number; removed: number } {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const prevSet = new Set(tokenize(prev));
  const nextSet = new Set(tokenize(next));
  let added = 0;
  let removed = 0;
  for (const t of nextSet) if (!prevSet.has(t)) added++;
  for (const t of prevSet) if (!nextSet.has(t)) removed++;
  return { added, removed };
}

export function ReasoningTimeline({
  prHistory,
  currentDraft,
  currentStage,
  isDirty,
}: ReasoningTimelineProps) {
  const latest = prHistory[prHistory.length - 1];

  const entries = useMemo(() => {
    type Entry = {
      kind: 'snapshot' | 'draft';
      id: string;
      stage: WorkflowStage;
      text: string;
      simTime: number;
      version: number;
      diff: { added: number; removed: number } | null;
    };
    const list: Entry[] = prHistory.map((snap, idx) => {
      const prev = idx > 0 ? prHistory[idx - 1] : null;
      const diff = prev ? diffSummary(prev.text, snap.text) : null;
      return {
        kind: 'snapshot',
        id: snap.id,
        stage: snap.stage,
        text: snap.text,
        simTime: snap.simTime,
        version: idx + 1,
        diff,
      };
    });
    // Append the working draft as the tip of the timeline when it differs
    // from the latest committed snapshot.
    if (isDirty && currentDraft.trim().length > 0) {
      list.push({
        kind: 'draft',
        id: 'draft',
        stage: currentStage,
        text: currentDraft,
        simTime: -1,
        version: prHistory.length + 1,
        diff: latest ? diffSummary(latest.text, currentDraft) : null,
      });
    }
    return list;
  }, [prHistory, currentDraft, currentStage, isDirty, latest]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <FileText className="w-8 h-8 text-clinical-slate/20 mx-auto" />
        <p className="text-xs text-clinical-slate/50 max-w-[220px] mx-auto leading-relaxed">
          Your PR timeline is empty. Write an initial problem representation
          above — it will be saved here each time you commit at a stage gate.
        </p>
      </div>
    );
  }

  return (
    <motion.ol
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative pl-5 space-y-3"
    >
      {/* vertical line */}
      <div
        aria-hidden="true"
        className="absolute left-[7px] top-2 bottom-2 w-px bg-clinical-line"
      />

      {entries.map((entry, entryIdx) => {
        const isDraft = entry.kind === 'draft';
        const isLastSnapshot = entry.kind === 'snapshot' && entryIdx === entries.length - 1;
        return (
          <li key={entry.id} className="relative">
            {/* node */}
            <div
              aria-hidden="true"
              className={cn(
                'absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                isDraft
                  ? 'bg-clinical-surface border-amber-400'
                  : isLastSnapshot
                  ? 'bg-teal-500 border-teal-600'
                  : 'bg-clinical-surface border-teal-500',
              )}
            >
              {isDraft ? (
                <Pencil className="w-1.5 h-1.5 text-amber-600" />
              ) : (
                <GitCommit className="w-1.5 h-1.5 text-white" />
              )}
            </div>

            <div
              className={cn(
                'rounded-lg border p-3',
                isDraft
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-clinical-bg/50 border-clinical-line',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-[9px] font-semibold uppercase tracking-wider',
                    isDraft ? 'text-amber-700' : 'text-teal-700',
                  )}
                >
                  {isDraft ? (
                    <>Working draft</>
                  ) : (
                    <>
                      v{entry.version} · {STAGE_LABELS[entry.stage]}
                    </>
                  )}
                </span>
                {!isDraft && (
                  <span className="flex items-center gap-0.5 text-[9px] text-clinical-slate/60 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    T+{entry.simTime}m
                  </span>
                )}
                {isDraft && (
                  <span className="flex items-center gap-0.5 text-[9px] text-amber-700/80">
                    <Sparkles className="w-2.5 h-2.5" />
                    uncommitted
                  </span>
                )}
                {entry.diff && (entry.diff.added > 0 || entry.diff.removed > 0) && (
                  <span className="ml-auto text-[9px] font-mono">
                    {entry.diff.added > 0 && (
                      <span className="text-green-600">+{entry.diff.added}</span>
                    )}
                    {entry.diff.added > 0 && entry.diff.removed > 0 && (
                      <span className="text-clinical-slate/40"> / </span>
                    )}
                    {entry.diff.removed > 0 && (
                      <span className="text-red-600">−{entry.diff.removed}</span>
                    )}
                    <span className="text-clinical-slate/40 ml-1">tokens</span>
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'text-[11px] leading-relaxed',
                  isDraft ? 'text-clinical-ink italic' : 'text-clinical-ink',
                )}
              >
                {entry.text.length > 240 ? `${entry.text.slice(0, 240)}…` : entry.text}
              </p>
            </div>
          </li>
        );
      })}
    </motion.ol>
  );
}
