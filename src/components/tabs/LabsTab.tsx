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

  const availableLabs = medicalCase.availableTests?.labs ?? [];
  const availableImaging = medicalCase.availableTests?.imaging ?? [];

  const handleOrder = () => {
    const name = orderInput.trim();
    if (!name) return;

    // Check if it matches an imaging type
    const matchesImaging = availableImaging.find(
      i => i.toLowerCase() === name.toLowerCase()
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
    | { kind: 'imaging'; type: string; impression?: string; findings?: string; time: number; pending: boolean };

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
                  <span className="text-xs text-gray-300">pending...</span>
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

          return (
            <div
              key={`img-${img.type}-${i}`}
              className="py-2.5 border-b border-gray-50"
            >
              <div className="flex items-baseline justify-between">
                <span className={cn(
                  'text-sm',
                  img.pending ? 'text-gray-300' : 'text-gray-600'
                )}>
                  {img.type}
                </span>
                {img.pending && (
                  <span className="text-xs text-gray-300">pending...</span>
                )}
              </div>
              {!img.pending && img.impression && (
                <p className="text-sm text-gray-900 mt-1 leading-relaxed">
                  {img.impression}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
