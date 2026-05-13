import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getRecentSimulations } from '../services/storageService';
import type { User } from '../lib/supabase';
import { cn } from '../lib/utils';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

interface ArchiveViewProps {
  user: User | null;
}

// Mini sparkline using SVG
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60, h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="inline-block shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function TrendIcon({ values }: { values: number[] }) {
  if (values.length < 2) return <Minus className="w-3 h-3 text-clinical-slate/50" />;
  const delta = values[values.length - 1] - values[values.length - 2];
  if (delta > 3)  return <TrendingUp   className="w-3 h-3 text-clinical-green" />;
  if (delta < -3) return <TrendingDown  className="w-3 h-3 text-clinical-red" />;
  return <Minus className="w-3 h-3 text-clinical-slate/50" />;
}

export function ArchiveView({ user }: ArchiveViewProps) {
  const [records, setRecords]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'table' | 'summary'>('table');

  useEffect(() => {
    if (user) {
      getRecentSimulations()
        .then(setRecords)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <EmptyState
        icon={<ShieldAlert className="w-10 h-10" />}
        title="Authentication Required"
        description="Clinical archives are encrypted. Please sign in to view your simulation history."
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-10 h-10" />}
        title="Archive Empty"
        description="Complete simulations to preserve clinical history."
      />
    );
  }

  // ── Per-category summary ──────────────────────────────────────────────────
  const categoryMap: Record<string, number[]> = {};
  records.forEach(r => {
    const cat = r.category || 'general';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(r.score ?? 0);
  });
  const categoryStats = Object.entries(categoryMap).map(([cat, scores]) => ({
    cat,
    count: scores.length,
    avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    scores, // chronological — oldest first
  })).sort((a, b) => b.count - a.count);

  const overallAvg = Math.round(records.reduce((s, r) => s + (r.score ?? 0), 0) / records.length);
  const allScores  = records.map(r => r.score ?? 0).reverse(); // oldest → newest

  return (
    <div className="flex flex-col">
      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/40 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Overall avg</span>
          <span className={cn(
            'text-sm font-bold',
            overallAvg >= 80 ? 'text-clinical-green' : overallAvg >= 60 ? 'text-clinical-blue' : 'text-clinical-amber'
          )}>{overallAvg}%</span>
          <MiniSparkline values={allScores} color={overallAvg >= 80 ? 'var(--color-clinical-green)' : overallAvg >= 60 ? 'var(--color-clinical-blue)' : 'var(--color-clinical-amber)'} />
          <TrendIcon values={allScores} />
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex flex-wrap gap-3">
          {categoryStats.map(({ cat, avg, scores }) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="text-[10px] capitalize text-gray-500">{cat}</span>
              <span className={cn(
                'text-[10px] font-bold',
                avg >= 80 ? 'text-clinical-green' : avg >= 60 ? 'text-clinical-blue' : 'text-clinical-amber'
              )}>{avg}%</span>
              <MiniSparkline values={scores} color={avg >= 80 ? 'var(--color-clinical-green)' : avg >= 60 ? 'var(--color-clinical-blue)' : 'var(--color-clinical-amber)'} />
              <TrendIcon values={scores} />
            </div>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(['table', 'summary'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'text-[10px] font-medium px-2.5 py-1 rounded transition-colors capitalize',
                view === v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-100'
              )}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* ── Table view ───────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="overflow-x-auto">
          <table className="clinical-table w-full" aria-label="Simulation archive records">
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Patient</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Category</th>
                <th scope="col">Score</th>
                <th scope="col">Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="hover:bg-clinical-bg/50 transition-colors">
                  <td className="text-xs font-mono whitespace-nowrap text-clinical-slate">
                    {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="font-medium text-clinical-ink">{r.patient_name} <span className="text-clinical-slate font-normal">({r.age}y)</span></td>
                  <td>
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      r.difficulty === 'attending' ? 'bg-clinical-red/8 text-clinical-red' :
                      r.difficulty === 'resident'  ? 'bg-clinical-amber/8 text-clinical-amber' :
                                                     'bg-clinical-green/8 text-clinical-green'
                    )}>{r.difficulty}</span>
                  </td>
                  <td className="text-xs text-clinical-slate capitalize">{r.category}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-semibold', r.score >= 80 ? 'text-clinical-green' : 'text-clinical-amber')}>{r.score}%</span>
                      <div className="w-12 h-1.5 bg-clinical-bg rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', r.score >= 80 ? 'bg-clinical-green' : 'bg-clinical-amber')} style={{ width: `${r.score}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="text-xs text-clinical-slate italic max-w-[200px] truncate">{r.correct_diagnosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Summary view ─────────────────────────────────────────────────── */}
      {view === 'summary' && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryStats.map(({ cat, count, avg, scores }) => (
            <div key={cat} className="bg-clinical-bg border border-clinical-line rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-clinical-ink capitalize">{cat}</p>
                  <p className="text-[10px] text-clinical-slate">{count} case{count !== 1 ? 's' : ''}</p>
                </div>
                <span className={cn(
                  'text-lg font-bold',
                  avg >= 80 ? 'text-clinical-green' : avg >= 60 ? 'text-clinical-blue' : 'text-clinical-amber'
                )}>{avg}%</span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 bg-clinical-line rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', avg >= 80 ? 'bg-clinical-green' : avg >= 60 ? 'bg-clinical-blue' : 'bg-clinical-amber')} style={{ width: `${avg}%` }} />
              </div>
              {/* Sparkline */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-clinical-slate">Trend</span>
                <div className="flex items-center gap-2">
                  <MiniSparkline values={scores} color={avg >= 80 ? 'var(--color-clinical-green)' : avg >= 60 ? 'var(--color-clinical-blue)' : 'var(--color-clinical-amber)'} />
                  <TrendIcon values={scores} />
                </div>
              </div>
              {/* Individual scores */}
              <div className="flex gap-1 flex-wrap">
                {scores.slice(-8).map((s, i) => (
                  <span key={i} className={cn(
                    'text-[9px] font-mono px-1.5 py-0.5 rounded',
                    s >= 80 ? 'bg-clinical-green/10 text-clinical-green' :
                    s >= 60 ? 'bg-clinical-blue/10 text-clinical-blue' :
                              'bg-clinical-amber/10 text-clinical-amber'
                  )}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
