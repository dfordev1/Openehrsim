import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { searchOrders } from '../services/geminiService';
import type { MedicalCase, OrderSearchResult } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  lab:       'bg-blue-50 text-blue-600',
  imaging:   'bg-purple-50 text-purple-600',
  medication:'bg-green-50 text-green-600',
  consult:   'bg-amber-50 text-amber-700',
  procedure: 'bg-gray-100 text-gray-600',
};
const CATEGORY_LABEL: Record<string, string> = {
  lab: 'Lab', imaging: 'Imaging', medication: 'Med', consult: 'Consult', procedure: 'Proc',
};

interface OrderBarProps {
  medicalCase: MedicalCase | null;
  simTime: number;
  intervening: boolean;
  onOpenTimeAdvance: () => void;
  onTransfer: (dept: string) => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onOrderMedication: (name: string, route?: string, frequency?: string) => Promise<void>;
  onPerformIntervention: (wait?: number, direct?: string) => Promise<void>;
  onOpenAssessment: () => void;
  onConsult: () => void;
}

export function OrderBar({
  medicalCase, simTime, intervening,
  onOpenTimeAdvance, onTransfer,
  onOrderTest, onOrderMedication, onPerformIntervention,
  onOpenAssessment, onConsult,
}: OrderBarProps) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      if (!medicalCase) return;
      setSearching(true);
      try {
        const res = await searchOrders(medicalCase.id, q);
        setSuggestions(res.results.slice(0, 6));
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 280);
  }, [medicalCase?.id]);

  const handleChange = (v: string) => {
    setValue(v);
    search(v);
  };

  const executeFreetextOrder = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    setSuggestions([]);
    await onPerformIntervention(5, text);
  };

  const placeOrder = async (item: OrderSearchResult) => {
    if (busy) return;
    setValue('');
    setSuggestions([]);
    setPlacing(true);
    try {
      if (item.category === 'lab') await onOrderTest('lab', item.name);
      else if (item.category === 'imaging') await onOrderTest('imaging', item.name);
      else if (item.category === 'medication') await onOrderMedication(item.name, item.route, item.frequency);
      else await onPerformIntervention(2, `${item.category === 'consult' ? 'Consult' : 'Perform'}: ${item.name}`);
    } finally { setPlacing(false); }
  };

  const busy = intervening || placing;
  const penaltyLevel = simTime >= 90 ? 'high' : simTime >= 60 ? 'moderate' : simTime >= 45 ? 'low' : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white">

      {/* Search suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="border-t border-gray-100 max-h-56 overflow-y-auto bg-white"
          >
            {suggestions.map(r => (
              <button
                key={r.name}
                onClick={() => placeOrder(r)}
                disabled={busy}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{r.name}</p>
                  {(r.route || r.frequency) && (
                    <p className="text-[10px] text-gray-400">{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', CATEGORY_COLOR[r.category] ?? 'bg-gray-100 text-gray-500')}>
                  {CATEGORY_LABEL[r.category] ?? r.category}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer dept picker */}
      <AnimatePresence>
        {transferOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex gap-5 px-4 py-2.5 border-t border-gray-100"
          >
            {['ICU', 'OR', 'Cath Lab', 'Ward', 'Radiology'].map(dept => (
              <button
                key={dept}
                onClick={() => { onTransfer(dept); setTransferOpen(false); }}
                disabled={busy}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30"
              >
                {dept}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time-pressure hint */}
      {penaltyLevel && (
        <p className={cn('px-4 py-1 text-[10px] border-t border-gray-50',
          penaltyLevel === 'low' ? 'text-amber-500' :
          penaltyLevel === 'moderate' ? 'text-orange-500' : 'text-red-500 font-medium'
        )}>
          {penaltyLevel === 'low'      && `⏱ T+${simTime}m — efficiency score beginning to drop.`}
          {penaltyLevel === 'moderate' && `⏱ T+${simTime}m — significant time penalty accumulating.`}
          {penaltyLevel === 'high'     && `⏱ T+${simTime}m — major efficiency penalty.`}
        </p>
      )}

      {/* Main input row */}
      <div className="border-t border-gray-100 px-4 pt-2.5 pb-safe-or-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeFreetextOrder(); }
              if (e.key === 'Escape') { setSuggestions([]); setValue(''); }
            }}
            placeholder={busy ? 'Processing…' : searching ? 'Searching…' : 'Order, medication, or intervention…'}
            disabled={busy || !medicalCase}
            className="flex-1 text-sm py-1 focus:outline-none bg-transparent placeholder-gray-300 disabled:opacity-50"
            autoComplete="off"
          />
          {value.trim() && !busy && (
            <button
              onClick={executeFreetextOrder}
              className="shrink-0 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full"
            >
              Execute
            </button>
          )}
        </div>

        {/* Action strip */}
        <div className="flex items-center gap-4 pt-1.5 pb-1">
          <button
            onClick={onOpenTimeAdvance}
            disabled={busy || !medicalCase}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30"
          >
            Advance time
          </button>
          <button
            onClick={() => setTransferOpen(p => !p)}
            disabled={busy || !medicalCase}
            className={cn('text-xs transition-colors disabled:opacity-30', transferOpen ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700')}
          >
            Transfer
          </button>
          <button
            onClick={onConsult}
            disabled={busy || !medicalCase}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30"
          >
            Consult AI
          </button>
          <button
            onClick={onOpenAssessment}
            disabled={!medicalCase}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30 ml-auto"
          >
            End case →
          </button>
        </div>
      </div>
    </div>
  );
}
