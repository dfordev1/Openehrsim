import React, { useState } from 'react';
import { Camera, CheckCircle2, Clock, FlaskConical, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface OrderedTest {
  name: string;
  type: 'lab' | 'imaging';
  orderedAt: number;
  availableAt: number;
}

interface OrderPanelProps {
  availableTests: { labs: string[]; imaging: string[] };
  currentSimTime: number;
  onOrderTest: (testType: 'lab' | 'imaging', testName: string) => Promise<void>;
  onAdvanceTime: (minutes: number) => Promise<void>;
  orderedTests: OrderedTest[];
  isProcessing: boolean;
}

type Tab = 'labs' | 'imaging' | 'time';

export function OrderPanel({
  availableTests,
  currentSimTime,
  onOrderTest,
  onAdvanceTime,
  orderedTests,
  isProcessing,
}: OrderPanelProps) {
  const [tab, setTab]             = useState<Tab>('labs');
  const [loadingTest, setLoading] = useState<string | null>(null);
  const [customMin, setCustomMin] = useState(15);

  const handleOrder = async (type: 'lab' | 'imaging', name: string) => {
    setLoading(name);
    try { await onOrderTest(type, name); }
    finally { setLoading(null); }
  };

  const statusOf = (name: string) => {
    const t = orderedTests.find((x) => x.name === name);
    if (!t) return null;
    if (t.availableAt <= currentSimTime) return 'ready';
    return `${t.availableAt - currentSimTime} min`;
  };

  const timeDisplay = `${Math.floor(currentSimTime / 60)}:${String(currentSimTime % 60).padStart(2, '0')}`;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Order Entry &amp; Time</span>
        <span className="text-xs font-mono text-clinical-blue">T+{currentSimTime} min</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-clinical-line">
        {(['labs', 'imaging', 'time'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
              tab === t
                ? 'text-clinical-blue border-b-2 border-clinical-blue bg-clinical-blue/5'
                : 'text-clinical-slate hover:text-clinical-ink hover:bg-clinical-bg'
            )}
          >
            {t === 'labs'    && <FlaskConical className="w-3.5 h-3.5" />}
            {t === 'imaging' && <Camera       className="w-3.5 h-3.5" />}
            {t === 'time'    && <Clock        className="w-3.5 h-3.5" />}
            <span className="capitalize">{t}</span>
          </button>
        ))}
      </div>

      {/* ── Pending tests summary ──────────────────────────────────────── */}
      {(() => {
        const pending = orderedTests.filter(t => t.availableAt > currentSimTime);
        if (!pending.length) return null;
        return (
          <div className="px-4 pb-3 -mt-1">
            <div className="bg-clinical-amber/5 border border-clinical-amber/20 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-clinical-amber uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {pending.length} result{pending.length !== 1 ? 's' : ''} pending
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pending.map(t => {
                  const eta = t.availableAt - currentSimTime;
                  const pct = Math.max(0, Math.min(100, 100 - (eta / Math.max(1, t.availableAt - t.orderedAt)) * 100));
                  return (
                    <div key={t.name} className="flex items-center gap-1.5 bg-clinical-surface border border-clinical-line rounded-md px-2 py-1">
                      <span className="text-[10px] font-medium text-clinical-ink">{t.name}</span>
                      <span className="text-[9px] text-clinical-amber font-mono">+{eta}m</span>
                      <div className="w-12 h-1 bg-clinical-line rounded-full overflow-hidden">
                        <div className="h-full bg-clinical-amber rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="p-4">
        <AnimatePresence mode="wait">

          {/* ── Labs ─────────────────────────────────────────────────────────── */}
          {tab === 'labs' && (
            <motion.div key="labs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableTests.labs.map((name) => {
                const st = statusOf(name);
                return (
                  <button
                    key={name}
                    onClick={() => !st && handleOrder('lab', name)}
                    disabled={!!st || isProcessing || loadingTest === name}
                    className={cn(
                      'p-2.5 rounded-lg text-left text-xs border transition-all',
                      st
                        ? 'bg-clinical-bg border-clinical-line cursor-not-allowed opacity-70'
                        : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium truncate">{name}</span>
                      {loadingTest === name && <Loader2 className="w-3 h-3 animate-spin text-clinical-blue shrink-0" />}
                      {st === 'ready'  && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
                      {st && st !== 'ready' && <Clock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </div>
                    {st && st !== 'ready' && (
                      <div className="text-[10px] text-amber-600 mt-0.5">{st}</div>
                    )}
                    {st === 'ready' && (
                      <div className="text-[10px] text-green-600 mt-0.5">Ready</div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ── Imaging ──────────────────────────────────────────────────────── */}
          {tab === 'imaging' && (
            <motion.div key="imaging" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-2">
              {availableTests.imaging.map((name) => {
                const st = statusOf(name);
                return (
                  <button
                    key={name}
                    onClick={() => !st && handleOrder('imaging', name)}
                    disabled={!!st || isProcessing || loadingTest === name}
                    className={cn(
                      'p-2.5 rounded-lg text-left text-xs border transition-all',
                      st
                        ? 'bg-clinical-bg border-clinical-line cursor-not-allowed opacity-70'
                        : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium truncate">{name}</span>
                      {loadingTest === name && <Loader2 className="w-3 h-3 animate-spin text-clinical-blue shrink-0" />}
                      {st === 'ready'  && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
                      {st && st !== 'ready' && <Clock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </div>
                    {st && st !== 'ready' && <div className="text-[10px] text-amber-600 mt-0.5">{st}</div>}
                    {st === 'ready'        && <div className="text-[10px] text-green-600 mt-0.5">Ready</div>}
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ── Time ─────────────────────────────────────────────────────────── */}
          {tab === 'time' && (
            <motion.div key="time" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">
              {/* Clock display */}
              <div className="bg-clinical-bg rounded-lg p-3 border border-clinical-line flex items-center justify-between">
                <span className="text-xs text-clinical-slate uppercase font-medium">Simulation Clock</span>
                <span className="text-2xl font-mono font-bold text-clinical-blue">{timeDisplay}</span>
              </div>

              {/* Quick advance */}
              <div>
                <p className="text-[10px] font-medium text-clinical-slate uppercase mb-2">Quick Advance</p>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map((m) => (
                    <button key={m} onClick={() => onAdvanceTime(m)} disabled={isProcessing}
                      className="py-2.5 bg-clinical-surface border border-clinical-line rounded-lg text-xs font-medium hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all disabled:opacity-50">
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom advance */}
              <div>
                <p className="text-[10px] font-medium text-clinical-slate uppercase mb-2">Custom</p>
                <div className="flex gap-2">
                  <input type="number" min={1} max={1440} value={customMin}
                    onChange={(e) => setCustomMin(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-clinical-bg border border-clinical-line rounded-lg text-sm focus:outline-none focus:border-clinical-blue" />
                  <button onClick={() => onAdvanceTime(customMin)} disabled={isProcessing || customMin < 1}
                    className="px-5 py-2 bg-clinical-blue text-white rounded-lg text-xs font-medium hover:bg-clinical-blue/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Advance'}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Patient condition evolves with time. Untreated conditions <strong>will</strong> deteriorate.
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
