import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { searchOrders } from '../../services/geminiService';
import { ActiveOrdersPanel } from '../ActiveOrdersPanel';
import type { MedicalCase, OrderSearchResult } from '../../types';

interface OrdersTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  intervening: boolean;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onOrderMedication: (name: string, route?: string, frequency?: string) => Promise<void>;
  onDiscontinueMedication: (id: string, name: string) => Promise<void>;
  onPerformIntervention: (wait?: number, direct?: string) => Promise<void>;
}

const CATEGORY_LABEL: Record<string, string> = {
  lab: 'Lab',
  imaging: 'Imaging',
  medication: 'Medication',
  consult: 'Consult',
  procedure: 'Procedure',
};

const CATEGORY_COLOR: Record<string, string> = {
  lab: 'bg-blue-50 text-blue-600',
  imaging: 'bg-purple-50 text-purple-600',
  medication: 'bg-green-50 text-green-600',
  consult: 'bg-amber-50 text-amber-700',
  procedure: 'bg-gray-100 text-gray-600',
};

export function OrdersTab({
  medicalCase,
  simTime,
  intervening,
  onOrderTest,
  onOrderMedication,
  onDiscontinueMedication,
  onPerformIntervention,
}: OrdersTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchOrders(medicalCase.id, q);
        setResults(res.results.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
  }, [medicalCase.id]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const confirmOrders = async () => {
    if (!selected.size || confirming) return;
    setConfirming(true);
    for (const item of results.filter(r => selected.has(r.name))) {
      if (item.category === 'lab') await onOrderTest('lab', item.name);
      else if (item.category === 'imaging') await onOrderTest('imaging', item.name);
      else if (item.category === 'medication') await onOrderMedication(item.name, item.route, item.frequency);
      else await onPerformIntervention(2, `${item.category === 'consult' ? 'Consult' : 'Perform'}: ${item.name}`);
    }
    setSelected(new Set());
    setQuery('');
    setResults([]);
    setConfirming(false);
  };

  return (
    <motion.div
      key="orders"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6 py-8"
    >
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          placeholder="Search labs, imaging, medications, consults…"
          className="w-full text-sm border-b border-gray-200 py-2.5 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent pr-16"
          autoComplete="off"
        />
        {searching && (
          <span className="absolute right-0 top-2.5 text-xs text-gray-300">searching…</span>
        )}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map(r => (
            <label
              key={r.name}
              className={cn(
                'flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors',
                selected.has(r.name) ? 'bg-gray-50' : 'hover:bg-gray-50'
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(r.name)}
                onChange={() => toggle(r.name)}
                className="accent-gray-900"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{r.name}</p>
                {(r.route || r.frequency) && (
                  <p className="text-[10px] text-gray-400">{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>
                )}
                {(r.stat != null) && (
                  <p className="text-[10px] text-gray-400">STAT {r.stat}m · Routine {r.routine}m</p>
                )}
              </div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', CATEGORY_COLOR[r.category] ?? 'bg-gray-100 text-gray-500')}>
                {CATEGORY_LABEL[r.category] ?? r.category}
              </span>
            </label>
          ))}

          {selected.size > 0 && (
            <div className="pt-2">
              <button
                onClick={confirmOrders}
                disabled={confirming || intervening}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-30 transition-opacity"
              >
                {confirming ? 'Placing…' : `Place ${selected.size} order${selected.size > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {results.length > 0 && <div className="border-t border-gray-100" />}

      {/* Active orders */}
      <ActiveOrdersPanel
        medicalCase={medicalCase}
        simTime={simTime}
        intervening={intervening}
        onDiscontinue={onDiscontinueMedication}
      />

      {/* Empty state */}
      {results.length === 0 && !query && (
        <p className="text-sm text-gray-300 pt-2">
          Type to search — labs, imaging, medications, consults, procedures.
        </p>
      )}

      {results.length === 0 && query && !searching && (
        <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
      )}
    </motion.div>
  );
}
