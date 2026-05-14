/**
 * CCS-style order search modal.
 *
 * Type a query → AI-powered backend returns matching labs, imaging, and
 * medications from the case catalog → check items → Confirm Orders.
 * "Broaden Search" asks the AI to expand beyond the catalog.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { searchOrders } from '../services/geminiService';
import type { OrderSearchResult } from '../types';

interface Props {
  caseId: string;
  onConfirm: (items: OrderSearchResult[]) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<OrderSearchResult['category'], string> = {
  lab:        'Lab',
  imaging:    'Imaging',
  medication: 'Medication',
};

const CATEGORY_COLOR: Record<OrderSearchResult['category'], string> = {
  lab:        'bg-blue-50 text-blue-700',
  imaging:    'bg-purple-50 text-purple-700',
  medication: 'bg-green-50 text-green-700',
};

export function OrderSearchModal({ caseId, onConfirm, onClose }: Props) {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<OrderSearchResult[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(false);
  const [broadening, setBroadening]   = useState(false);
  const [error, setError]             = useState('');
  const inputRef                      = useRef<HTMLInputElement>(null);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-focus search input
  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string, broaden = false) => {
    if (!q.trim()) { setResults([]); return; }
    broaden ? setBroadening(true) : setLoading(true);
    setError('');
    try {
      const data = await searchOrders(caseId, q, broaden);
      setResults(data.results);
    } catch {
      setError('Search failed — try again');
    } finally {
      setLoading(false);
      setBroadening(false);
    }
  }, [caseId]);

  // Debounced search on keystroke
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => doSearch(query), 320);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const toggleItem = (name: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const handleConfirm = () => {
    const items = results.filter(r => selected.has(r.name));
    if (items.length > 0) onConfirm(items);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative bg-clinical-surface rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-clinical-line">
            <span className="text-sm font-semibold text-clinical-ink">Order Verification</span>
            <button onClick={onClose} className="text-clinical-slate hover:text-clinical-ink-muted transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Search input */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 border border-clinical-line rounded-lg px-3 py-2 focus-within:border-clinical-teal transition-colors">
              <Search size={14} className="text-clinical-slate shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to search labs, imaging, medications…"
                className="flex-1 text-sm outline-none bg-transparent placeholder-clinical-slate/40 text-clinical-ink"
              />
              {loading && <Loader2 size={14} className="text-clinical-slate animate-spin shrink-0" />}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0">
            {error && (
              <p className="text-xs text-red-500 py-2">{error}</p>
            )}

            {!query.trim() && (
              <p className="text-xs text-clinical-slate/50 py-4 text-center">
                Start typing to search orders
              </p>
            )}

            {query.trim() && !loading && results.length === 0 && !error && (
              <p className="text-xs text-clinical-slate py-4 text-center">
                No matches — try Broaden Search
              </p>
            )}

            {results.map(item => {
              const isChecked = selected.has(item.name);
              return (
                <button
                  key={item.name}
                  onClick={() => toggleItem(item.name)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors mb-0.5',
                    isChecked ? 'bg-blue-50' : 'hover:bg-clinical-line/50'
                  )}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    isChecked ? 'border-blue-600 bg-blue-600' : 'border-clinical-line'
                  )}>
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* Name + sub-details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-clinical-ink truncate">{item.name}</p>
                    {item.category === 'medication' && (item.route || item.frequency) && (
                      <p className="text-xs text-clinical-slate truncate">
                        {[item.route, item.frequency].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.category !== 'medication' && item.stat != null && (
                      <p className="text-xs text-clinical-slate">
                        STAT {item.stat}m · Routine {item.routine}m
                      </p>
                    )}
                  </div>

                  {/* Category badge */}
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0',
                    CATEGORY_COLOR[item.category]
                  )}>
                    {CATEGORY_LABEL[item.category]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-clinical-line bg-clinical-line/50">
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className={cn(
                'flex-1 text-sm font-medium py-2 rounded-lg transition-colors',
                selected.size > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-clinical-line text-clinical-slate cursor-not-allowed'
              )}
            >
              Confirm Orders ({selected.size})
            </button>

            <button
              onClick={() => doSearch(query, true)}
              disabled={!query.trim() || broadening}
              className="text-sm font-medium text-clinical-ink-muted hover:text-clinical-ink disabled:text-clinical-slate/50 transition-colors px-2 py-2 whitespace-nowrap"
            >
              {broadening ? (
                <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Broadening…</span>
              ) : 'Broaden Search'}
            </button>

            <button
              onClick={onClose}
              className="text-sm font-medium text-clinical-slate hover:text-clinical-ink transition-colors px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
