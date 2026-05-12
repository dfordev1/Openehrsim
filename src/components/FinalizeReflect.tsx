import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Search, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { DifferentialEntry } from '../types';

interface FinalizeReflectProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { confidence: string; mentalDemand: number }) => void;
  differentials: DifferentialEntry[];
  onAddDifferential: (diagnosis: string) => void;
  onRemoveDifferential: (id: string) => void;
}

const CONFIDENCE_OPTIONS = [
  { value: 'know', label: 'I know it is' },
  { value: 'think', label: 'I think so' },
  { value: 'unsure', label: "I'm unsure" },
  { value: 'no_idea', label: 'I have no idea' },
];

export function FinalizeReflect({
  isOpen, onClose, onComplete,
  differentials, onAddDifferential, onRemoveDifferential,
}: FinalizeReflectProps) {
  const [searchInput, setSearchInput] = useState('');
  const [confidence, setConfidence] = useState('');
  const [mentalDemand, setMentalDemand] = useState(5);

  if (!isOpen) return null;

  const canComplete = differentials.length >= 3 && differentials.length <= 15 && confidence !== '';

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
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-clinical-line">
          <h2 className="text-base font-bold text-clinical-ink">FINALIZE AND REFLECT</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-clinical-bg rounded-md">
            <X className="w-4 h-4 text-clinical-slate" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* 1. Final Diagnoses */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-clinical-ink">Find your final diagnoses</h3>
                <p className="text-[10px] text-clinical-slate mt-0.5">
                  You must have at least 3 (and no more than 15) ranked diagnoses.
                </p>
              </div>
            </div>

            <div className="relative ml-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/50" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    onAddDifferential(searchInput.trim());
                    setSearchInput('');
                  }
                }}
                placeholder="Find diagnosis... START TYPING"
                className="w-full pl-9 pr-3 py-2.5 bg-clinical-bg border border-clinical-line rounded-lg text-xs focus:outline-none focus:border-teal-500"
              />
            </div>

            {differentials.length > 0 && (
              <div className="ml-8 space-y-1">
                {differentials.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 bg-clinical-bg/50 border border-clinical-line rounded-md text-xs">
                    <span className="font-mono text-clinical-slate/50 w-4">{i + 1}.</span>
                    <span className="flex-1 text-clinical-ink">{d.diagnosis}</span>
                    <button onClick={() => onRemoveDifferential(d.id)} className="text-clinical-slate/30 hover:text-clinical-red">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {differentials.length < 3 && (
              <div className="ml-8 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                You need at least {3 - differentials.length} more diagnosis{3 - differentials.length > 1 ? 'es' : ''}
              </div>
            )}
          </div>

          {/* 2. Confidence Rating */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-clinical-ink">Rate your confidence level</h3>
                <p className="text-[10px] text-clinical-slate mt-0.5">Select your confidence in your lead diagnosis.</p>
              </div>
            </div>

            <div className="ml-8 space-y-1.5">
              {CONFIDENCE_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                    confidence === opt.value
                      ? 'bg-teal-50 border-teal-300 text-teal-800'
                      : 'bg-white border-clinical-line hover:border-teal-200 text-clinical-ink'
                  )}
                >
                  <input
                    type="radio"
                    name="confidence"
                    value={opt.value}
                    checked={confidence === opt.value}
                    onChange={(e) => setConfidence(e.target.value)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Mental Demand */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-clinical-ink">How mentally demanding was this encounter?</h3>
              </div>
            </div>

            <div className="ml-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-clinical-slate">Very low</span>
                <span className="text-[10px] text-clinical-slate">Very high</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(val => (
                  <button
                    key={val}
                    onClick={() => setMentalDemand(val)}
                    className={cn(
                      'flex-1 h-9 rounded-md text-xs font-bold transition-all border',
                      mentalDemand === val
                        ? 'bg-teal-600 text-white border-teal-700 scale-110 shadow-md'
                        : val <= mentalDemand
                        ? 'bg-teal-100 text-teal-700 border-teal-200'
                        : 'bg-clinical-bg text-clinical-slate border-clinical-line hover:border-teal-300'
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-clinical-line">
          <button
            onClick={() => onComplete({ confidence, mentalDemand })}
            disabled={!canComplete}
            className={cn(
              'w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
              canComplete
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'bg-clinical-line text-clinical-slate/50 cursor-not-allowed'
            )}
          >
            {canComplete ? (
              <><CheckCircle2 className="w-4 h-4" /> COMPLETE ASSESSMENT</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> COMPLETE ASSESSMENT</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
