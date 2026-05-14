import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { MedicalCase, LabResult } from '../../types';

interface LabsTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  selectedLab: LabResult | null;
  onSelectLab: (lab: LabResult) => void;
}

export function LabsTab({ medicalCase, simTime, selectedLab, onSelectLab }: LabsTabProps) {
  const [expandedImaging, setExpandedImaging] = useState<string | null>(null);

  type ResultItem =
    | { kind: 'lab'; lab: LabResult; time: number }
    | { kind: 'imaging'; type: string; impression?: string; findings?: string; time: number; pending: boolean; availableAt?: number };

  const results: ResultItem[] = [];

  (medicalCase.labs || []).forEach(lab => {
    if (lab.orderedAt === undefined) return;
    results.push({ kind: 'lab', lab, time: lab.orderedAt });
  });

  (medicalCase.imaging || []).forEach(img => {
    if (img.orderedAt === undefined) return;
    const pending = img.availableAt === undefined || img.availableAt > simTime;
    results.push({
      kind: 'imaging',
      type: img.type,
      impression: img.impression,
      findings: img.findings,
      time: img.orderedAt,
      pending,
      availableAt: img.availableAt,
    });
  });

  results.sort((a, b) => b.time - a.time);

  return (
    <motion.div
      key="labs"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4 py-8"
    >
      {results.length === 0 && (
        <p className="text-sm text-clinical-slate/50 py-4">No results yet — order tests from the Orders tab.</p>
      )}

      <div className="space-y-1">
        {results.map((item, i) => {
          if (item.kind === 'lab') {
            const lab = item.lab;
            const available = lab.availableAt !== undefined && lab.availableAt <= simTime;
            const pending = lab.orderedAt !== undefined && !available;

            return (
              <button
                key={`lab-${lab.name}-${i}`}
                onClick={() => available && onSelectLab(lab)}
                className={cn(
                  'w-full text-left py-2.5 border-b border-clinical-line/50 flex items-baseline justify-between transition-colors',
                  available && 'cursor-pointer hover:bg-clinical-line/50'
                )}
              >
                <span className={cn('text-sm', pending ? 'text-clinical-slate/50' : 'text-clinical-ink-muted')}>
                  {lab.name}
                </span>
                {pending ? (
                  <span className="text-xs text-clinical-slate/50">T+{lab.availableAt}m</span>
                ) : available ? (
                  <span className={cn(
                    'font-mono text-sm',
                    lab.status === 'critical' && 'font-bold text-red-600 bg-red-50 px-1.5 rounded',
                    lab.status === 'abnormal' && 'font-bold text-red-600',
                    lab.status === 'normal' && 'text-clinical-ink'
                  )}>
                    {lab.value} {lab.unit}
                  </span>
                ) : null}
              </button>
            );
          }

          const img = item;
          if (img.kind !== 'imaging') return null;
          const imgKey = `${img.type}-${i}`;
          const isExpanded = expandedImaging === imgKey;

          return (
            <div key={`img-${img.type}-${i}`} className="border-b border-clinical-line/50">
              <button
                onClick={() => !img.pending && setExpandedImaging(isExpanded ? null : imgKey)}
                disabled={img.pending}
                className={cn(
                  'w-full text-left py-2.5 flex items-baseline justify-between',
                  !img.pending && 'cursor-pointer hover:bg-clinical-line/50'
                )}
              >
                <span className={cn('text-sm', img.pending ? 'text-clinical-slate/50' : 'text-clinical-ink-muted')}>
                  {img.type}
                </span>
                {img.pending
                  ? <span className="text-xs text-clinical-slate/50">T+{img.availableAt ?? '?'}m</span>
                  : <span className="text-xs text-clinical-slate">{isExpanded ? '▲' : '▼ Report'}</span>
                }
              </button>

              {isExpanded && !img.pending && (
                <div className="bg-clinical-line/50 rounded-lg p-4 mb-2 space-y-3">
                  <p className="text-[10px] font-semibold text-clinical-slate uppercase tracking-widest">{img.type}</p>
                  {img.findings && (
                    <div>
                      <p className="text-[10px] font-medium text-clinical-slate uppercase mb-1">Findings</p>
                      <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-line">{img.findings}</p>
                    </div>
                  )}
                  {img.impression && (
                    <div className="border-t border-clinical-line pt-3">
                      <p className="text-[10px] font-medium text-clinical-slate uppercase mb-1">Impression</p>
                      <p className="text-sm font-medium text-clinical-ink leading-relaxed">{img.impression}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
