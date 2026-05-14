import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { MedicalCase, LabResult } from '../../types';

interface LabsTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  selectedLab: LabResult | null;
  onSelectLab: (lab: LabResult) => void;
  onOrderLab: (name: string) => void;
  /** Imaging support (merged Tests view) */
  revealedStudies?: string[];
  onRevealStudy?: (type: string) => void;
  onOrderImaging?: (name: string) => void;
}

export function LabsTab({
  medicalCase,
  simTime,
  selectedLab,
  onSelectLab,
  onOrderLab,
  revealedStudies = [],
  onRevealStudy,
  onOrderImaging,
}: LabsTabProps) {
  const [orderInput, setOrderInput] = useState('');
  const [expandedImaging, setExpandedImaging] = useState<string | null>(null);

  // AvailableTest objects → name strings for display/matching
  const availableLabs = (medicalCase.availableTests?.labs ?? []).map(
    (t: any) => (typeof t === 'string' ? t : t.name) as string
  );
  const availableImaging = (medicalCase.availableTests?.imaging ?? []).map(
    (t: any) => (typeof t === 'string' ? t : t.name) as string
  );

  const handleOrder = () => {
    const name = orderInput.trim();
    if (!name) return;

    const matchesImaging = availableImaging.find(
      (i: string) => i.toLowerCase() === name.toLowerCase()
    );
    if (matchesImaging && onOrderImaging) {
      onOrderImaging(matchesImaging);
    } else {
      onOrderLab(name);
    }
    setOrderInput('');
  };

  // Build unified results list sorted by time
  type ResultItem =
    | { kind: 'lab'; lab: LabResult; time: number }
    | { kind: 'imaging'; type: string; impression?: string; findings?: string; time: number; pending: boolean; availableAt?: number };

  const results: ResultItem[] = [];

  (medicalCase.labs || []).forEach(lab => {
    if (lab.orderedAt === undefined) return;
    const available = lab.availableAt !== undefined && lab.availableAt <= simTime;
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
      className="flex flex-col gap-8 py-8"
    >
      {/* Order input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleOrder(); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={orderInput}
          onChange={(e) => setOrderInput(e.target.value)}
          placeholder="Order a test..."
          className="flex-1 text-sm border-b border-gray-200 py-2 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent"
          list="available-tests"
        />
        <button
          type="submit"
          disabled={!orderInput.trim()}
          className="text-sm font-medium text-gray-900 disabled:text-gray-300 transition-colors"
        >
          Order
        </button>
      </form>

      {/* Autocomplete datalist */}
      <datalist id="available-tests">
        {availableLabs.map(name => <option key={name} value={name} />)}
        {availableImaging.map(name => <option key={name} value={name} />)}
      </datalist>

      {/* Results list */}
      <div className="space-y-1">
        {results.length === 0 && (
          <p className="text-sm text-gray-300 py-4">No tests ordered yet.</p>
        )}

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
                  'w-full text-left py-2.5 border-b border-gray-50 flex items-baseline justify-between transition-colors',
                  available && 'cursor-pointer hover:bg-gray-50'
                )}
              >
                <span className={cn(
                  'text-sm',
                  pending ? 'text-gray-300' : 'text-gray-600'
                )}>
                  {lab.name}
                </span>
                {pending ? (
                  <span className="text-xs text-gray-300">T+{lab.availableAt}m</span>
                ) : available ? (
                  <span className={cn(
                    'font-mono text-sm',
                    lab.status === 'critical' && 'font-bold text-red-600 bg-red-50 px-1.5 rounded',
                    lab.status === 'abnormal' && 'font-bold text-red-600',
                    lab.status === 'normal' && 'text-gray-900'
                  )}>
                    {lab.value} {lab.unit}
                  </span>
                ) : null}
              </button>
            );
          }

          // Imaging result
          const img = item;
          if (img.kind !== 'imaging') return null;
          const imgKey = `${img.type}-${i}`;
          const isExpanded = expandedImaging === imgKey;

          return (
            <div key={`img-${img.type}-${i}`} className="border-b border-gray-50">
              <button
                onClick={() => !img.pending && setExpandedImaging(isExpanded ? null : imgKey)}
                disabled={img.pending}
                className={cn(
                  'w-full text-left py-2.5 flex items-baseline justify-between',
                  !img.pending && 'cursor-pointer hover:bg-gray-50'
                )}
              >
                <span className={cn('text-sm', img.pending ? 'text-gray-300' : 'text-gray-600')}>
                  {img.type}
                </span>
                {img.pending
                  ? <span className="text-xs text-gray-300">T+{img.availableAt ?? '?'}m</span>
                  : <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼ Report'}</span>
                }
              </button>

              {/* Expanded imaging report */}
              {isExpanded && !img.pending && (
                <div className="bg-gray-50 rounded-lg p-4 mb-2 space-y-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{img.type}</p>
                  {img.findings && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Findings</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{img.findings}</p>
                    </div>
                  )}
                  {img.impression && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Impression</p>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">{img.impression}</p>
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
