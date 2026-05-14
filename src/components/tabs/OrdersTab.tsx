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
  interventionInput: string;
  transferExpanded: boolean;
  onInterventionChange: (val: string) => void;
  onExecuteOrder: () => void;
  onOpenTimeAdvance: () => void;
  onTransfer: (dept: string) => void;
  onToggleTransfer: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onOrderMedication: (name: string, route?: string, frequency?: string) => Promise<void>;
  onDiscontinueMedication: (id: string, name: string) => Promise<void>;
  onPerformIntervention: (wait?: number, direct?: string) => Promise<void>;
}

const CATEGORY_COLOR: Record<string, string> = {
  lab:       'bg-blue-50 text-blue-600',
  imaging:   'bg-purple-50 text-purple-600',
  medication:'bg-green-50 text-green-600',
  consult:   'bg-amber-50 text-amber-700',
  procedure: 'bg-gray-100 text-gray-600',
};
const CATEGORY_LABEL: Record<string, string> = {
  lab: 'Lab', imaging: 'Imaging', medication: 'Medication', consult: 'Consult', procedure: 'Procedure',
};

export function OrdersTab({
  medicalCase, simTime, intervening,
  interventionInput, transferExpanded,
  onInterventionChange, onExecuteOrder,
  onOpenTimeAdvance, onTransfer, onToggleTransfer,
  onOrderTest, onOrderMedication, onDiscontinueMedication, onPerformIntervention,
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
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 320);
  }, [medicalCase.id]);

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const confirmOrders = async () => {
    if (!selected.size || confirming) return;
    setConfirming(true);
    for (const item of results.filter(r => selected.has(r.name))) {
      if (item.category === 'lab') await onOrderTest('lab', item.name);
      else if (item.category === 'imaging') await onOrderTest('imaging', item.name);
      else if (item.category === 'medication') await onOrderMedication(item.name, item.route, item.frequency);
      else await onPerformIntervention(2, `${item.category === 'consult' ? 'Consult' : 'Perform'}: ${item.name}`);
    }
    setSelected(new Set()); setQuery(''); setResults([]);
    setConfirming(false);
  };

  const trend = medicalCase.physiologicalTrend;
  const penaltyLevel = simTime >= 90 ? 'high' : simTime >= 60 ? 'moderate' : simTime >= 45 ? 'low' : null;

  return (
    <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 py-8">

      {/* Vitals + trend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 font-mono">
          HR {medicalCase.vitals.heartRate} · BP {medicalCase.vitals.bloodPressure} · SpO2 {medicalCase.vitals.oxygenSaturation}% · RR {medicalCase.vitals.respiratoryRate} · {medicalCase.vitals.temperature}°C
        </p>
        {trend && trend !== 'stable' && (
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
            trend === 'improving' && 'bg-green-50 text-green-600',
            trend === 'declining' && 'bg-amber-50 text-amber-600',
            trend === 'critical'  && 'bg-red-50 text-red-600 animate-pulse',
          )}>
            {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '⚠ Critical'}
          </span>
        )}
      </div>

      {/* Time pressure */}
      {penaltyLevel && (
        <p className={cn('text-xs',
          penaltyLevel === 'low'      && 'text-amber-500',
          penaltyLevel === 'moderate' && 'text-orange-500',
          penaltyLevel === 'high'     && 'text-red-500 font-medium',
        )}>
          {penaltyLevel === 'low'      && `⏱ T+${simTime}m — efficiency score beginning to drop.`}
          {penaltyLevel === 'moderate' && `⏱ T+${simTime}m — significant time penalty accumulating.`}
          {penaltyLevel === 'high'     && `⏱ T+${simTime}m — major efficiency penalty. Expedite management.`}
        </p>
      )}

      {/* ── Search orders ── */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          placeholder="Search labs, imaging, medications, consults…"
          className="w-full text-sm border-b border-gray-200 py-2.5 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent pr-20"
          autoComplete="off"
        />
        {searching && <span className="absolute right-0 top-2.5 text-xs text-gray-300">searching…</span>}
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map(r => (
            <label key={r.name} className={cn(
              'flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors',
              selected.has(r.name) ? 'bg-gray-50' : 'hover:bg-gray-50'
            )}>
              <input type="checkbox" checked={selected.has(r.name)} onChange={() => toggle(r.name)} className="accent-gray-900" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{r.name}</p>
                {(r.route || r.frequency) && <p className="text-[10px] text-gray-400">{[r.route, r.frequency].filter(Boolean).join(' · ')}</p>}
                {r.stat != null && <p className="text-[10px] text-gray-400">STAT {r.stat}m · Routine {r.routine}m</p>}
              </div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', CATEGORY_COLOR[r.category] ?? 'bg-gray-100 text-gray-500')}>
                {CATEGORY_LABEL[r.category] ?? r.category}
              </span>
            </label>
          ))}
          {selected.size > 0 && (
            <div className="pt-2">
              <button onClick={confirmOrders} disabled={confirming || intervening}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-30 transition-opacity">
                {confirming ? 'Placing…' : `Place ${selected.size} order${selected.size > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      {results.length === 0 && !query && (
        <p className="text-xs text-gray-300">Type to search — labs, imaging, medications, consults, procedures.</p>
      )}
      {results.length === 0 && query && !searching && (
        <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
      )}

      {/* ── Free-text intervention ── */}
      <div className="border-t border-gray-100 pt-6">
        <textarea
          value={interventionInput}
          onChange={e => onInterventionChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (interventionInput.trim() && !intervening) onExecuteOrder(); } }}
          placeholder="Free-text order or intervention…"
          className="w-full text-sm border-b border-gray-200 py-3 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent resize-none leading-relaxed"
          rows={2}
        />
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <button onClick={onExecuteOrder} disabled={intervening || !interventionInput.trim()}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-30 transition-opacity">
            Execute
          </button>
          <button onClick={onOpenTimeAdvance} disabled={intervening}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30">
            Obtain Results or See Patient Later
          </button>
          <button onClick={onToggleTransfer} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Transfer
          </button>
        </div>
      </div>

      {/* Transfer options */}
      {transferExpanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-3 text-sm">
          {['ICU', 'OR', 'Cath Lab', 'Ward', 'Radiology'].map(dept => (
            <button key={dept} onClick={() => onTransfer(dept)} disabled={intervening}
              className="text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30">
              {dept}
            </button>
          ))}
        </motion.div>
      )}

      {/* ── Active orders ── */}
      <ActiveOrdersPanel medicalCase={medicalCase} simTime={simTime} intervening={intervening} onDiscontinue={onDiscontinueMedication} />

      {/* ── Activity log ── */}
      {(medicalCase.clinicalActions || []).length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Activity log</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {[...medicalCase.clinicalActions].reverse().map((action, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="font-mono shrink-0 text-gray-300">T+{action.timestamp}m</span>
                <span className="text-gray-500">{action.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
