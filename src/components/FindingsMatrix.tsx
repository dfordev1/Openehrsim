import { memo, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Grid3x3, Plus, Minus, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ClinicalFinding, DifferentialEntry } from '../types';

type Relevance = 'positive' | 'negative' | 'none';

interface FindingsMatrixProps {
  findings: ClinicalFinding[];
  differentials: DifferentialEntry[];
  onUpdateCell: (
    findingId: string,
    differentialId: string,
    relevance: Relevance,
  ) => void;
}

const SOURCE_COLOR: Record<ClinicalFinding['source'], string> = {
  history: 'bg-blue-400',
  exam: 'bg-indigo-400',
  lab: 'bg-clinical-green',
  imaging: 'bg-purple-400',
  vitals: 'bg-clinical-red',
};

/** Cycle: none → positive → negative → none */
function nextRelevance(current: Relevance): Relevance {
  if (current === 'none') return 'positive';
  if (current === 'positive') return 'negative';
  return 'none';
}

// ── Memoized cell ──────────────────────────────────────────────────────────
// Re-renders only when its own relevance changes or its callback identity
// changes. Previously every cell in the matrix re-rendered on every parent
// update, which starts hurting at ~50 findings × 10+ differentials.
interface CellProps {
  findingId: string;
  differentialId: string;
  relevance: Relevance;
  onUpdate: (findingId: string, differentialId: string, relevance: Relevance) => void;
}

const Cell = memo(function Cell({ findingId, differentialId, relevance, onUpdate }: CellProps) {
  const handleClick = useCallback(
    () => onUpdate(findingId, differentialId, nextRelevance(relevance)),
    [findingId, differentialId, relevance, onUpdate],
  );
  const base =
    'w-full h-full flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-clinical-teal';
  if (relevance === 'positive') {
    return (
      <button
        onClick={handleClick}
        className={cn(base, 'bg-clinical-green/15 hover:bg-clinical-green/25 text-clinical-green')}
        aria-label="Pertinent positive — click to toggle"
      >
        <Plus className="w-3 h-3" />
      </button>
    );
  }
  if (relevance === 'negative') {
    return (
      <button
        onClick={handleClick}
        className={cn(base, 'bg-clinical-red/15 hover:bg-clinical-red/25 text-clinical-red')}
        aria-label="Pertinent negative — click to toggle"
      >
        <Minus className="w-3 h-3" />
      </button>
    );
  }
  return (
    <button
      onClick={handleClick}
      className={cn(base, 'bg-clinical-bg/60 hover:bg-clinical-bg text-clinical-slate/30')}
      aria-label="Unassigned — click to mark positive"
    >
      <span className="text-[10px]">·</span>
    </button>
  );
});

// ── Memoized row ───────────────────────────────────────────────────────────
// Keeps the row static when unrelated findings change. We pass only the
// minimal slice of each finding's relevanceByDx so cell identity is stable.
interface RowProps {
  finding: ClinicalFinding;
  differentials: DifferentialEntry[];
  onUpdateCell: (findingId: string, differentialId: string, relevance: Relevance) => void;
}

const Row = memo(function Row({ finding, differentials, onUpdateCell }: RowProps) {
  return (
    <tr className="border-t border-clinical-line/40">
      <td className="sticky left-0 z-10 bg-clinical-surface px-3 py-1.5 align-middle">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0 mt-1',
              SOURCE_COLOR[finding.source],
            )}
            title={finding.source}
          />
          <span className="text-clinical-ink leading-snug">{finding.text}</span>
        </div>
      </td>
      {differentials.map(d => {
        const current: Relevance =
          (finding.relevanceByDx && finding.relevanceByDx[d.id]) || 'none';
        return (
          <td key={d.id} className="border-l border-clinical-line/40 h-8 p-0">
            <Cell
              findingId={finding.id}
              differentialId={d.id}
              relevance={current}
              onUpdate={onUpdateCell}
            />
          </td>
        );
      })}
    </tr>
  );
});

export function FindingsMatrix({
  findings,
  differentials,
  onUpdateCell,
}: FindingsMatrixProps) {
  // Per-dx score to aid interpretation: how many pertinent positives does
  // each differential accumulate?
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

  if (findings.length === 0 || differentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
        <Grid3x3 className="w-8 h-8 text-clinical-slate/20" />
        <p className="text-xs text-clinical-slate/60 max-w-[240px] leading-relaxed">
          {findings.length === 0 && differentials.length === 0 &&
            'Add findings and differentials to reconcile them in a matrix.'}
          {findings.length === 0 && differentials.length > 0 &&
            'No findings tracked yet. Examine the patient or review vitals to populate findings.'}
          {findings.length > 0 && differentials.length === 0 &&
            'Add at least one differential diagnosis to start reconciling findings.'}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-[10px] text-clinical-slate">
        <span className="font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <Grid3x3 className="w-3 h-3" /> Findings × Differentials
        </span>
        <span className="font-normal">
          Click a cell: · → <span className="text-clinical-green">+</span> →{' '}
          <span className="text-clinical-red">−</span> → ·
        </span>
      </div>

      <div className="overflow-x-auto border border-clinical-line rounded-lg">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-clinical-bg/50">
              <th className="sticky left-0 z-10 bg-clinical-bg/90 text-left px-3 py-2 font-semibold text-clinical-slate w-[180px] min-w-[180px]">
                Finding
              </th>
              {differentials.map(d => (
                <th
                  key={d.id}
                  className="px-2 py-2 border-l border-clinical-line/60 min-w-[90px] max-w-[120px] text-center"
                  title={d.diagnosis}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1 justify-center">
                      {d.isLead && (
                        <Star className="w-2.5 h-2.5 text-clinical-teal fill-current" />
                      )}
                      <span className="font-semibold text-clinical-ink truncate max-w-[80px]">
                        {d.diagnosis}
                      </span>
                    </div>
                    <span className="text-[9px] text-clinical-slate/70 font-normal">
                      <span className="text-clinical-green">
                        +{dxScores[d.id]?.pos ?? 0}
                      </span>
                      {' / '}
                      <span className="text-clinical-red">
                        −{dxScores[d.id]?.neg ?? 0}
                      </span>
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {findings.map(f => (
              <Row
                key={f.id}
                finding={f}
                differentials={differentials}
                onUpdateCell={onUpdateCell}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-clinical-slate/70 pt-1">
        {Object.entries(SOURCE_COLOR).map(([src, cls]) => (
          <span key={src} className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full', cls)} />
            <span className="capitalize">{src}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}
