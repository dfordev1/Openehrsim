import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LOCKED_SENTINEL } from '../lib/constants';
import type { MedicalCase, LabResult, ImagingResult } from '../types';

const GCS_MAPPING = {
  eyes:   [{ score: 4, label: 'Spontaneous' }, { score: 3, label: 'To Speech' }, { score: 2, label: 'To Pain' }, { score: 1, label: 'None' }],
  verbal: [{ score: 5, label: 'Oriented' }, { score: 4, label: 'Confused' }, { score: 3, label: 'Inappropriate' }, { score: 2, label: 'Incomprehensible' }, { score: 1, label: 'None' }],
  motor:  [{ score: 6, label: 'Obeys Commands' }, { score: 5, label: 'Localizes' }, { score: 4, label: 'Withdraws' }, { score: 3, label: 'Abnormal Flexion' }, { score: 2, label: 'Extension' }, { score: 1, label: 'None' }],
};

interface Props {
  medicalCase: MedicalCase;
  simTime: number;
  intervening: boolean;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (cat: 'eyes' | 'verbal' | 'motor', score: number) => void;
  onExamineSystem: (system: string, finding: string) => void;
  onDiscontinueMedication: (id: string, name: string) => Promise<void>;
}

// ── Timeline event types ───────────────────────────────────────────────────────
type TEvent =
  | { kind: 'action'; id: string; description: string }
  | { kind: 'lab';    data: LabResult }
  | { kind: 'imaging'; data: ImagingResult };

interface TimeGroup {
  time: number;
  events: TEvent[];
}

function buildGroups(medicalCase: MedicalCase, simTime: number): TimeGroup[] {
  const raw: { time: number; event: TEvent }[] = [];

  // Clinicial actions — exclude exam reveals and time-advance entries (communicated by dividers)
  for (const a of medicalCase.clinicalActions ?? []) {
    if (a.type === 'exam' || a.type === 'time-advance') continue;
    raw.push({ time: a.timestamp, event: { kind: 'action', id: a.id, description: a.description } });
  }

  // Available lab results
  for (const lab of medicalCase.labs ?? []) {
    if (lab.orderedAt === undefined || lab.availableAt === undefined || lab.availableAt > simTime) continue;
    raw.push({ time: lab.availableAt, event: { kind: 'lab', data: lab } });
  }

  // Available imaging results
  for (const img of medicalCase.imaging ?? []) {
    if (img.orderedAt === undefined || img.availableAt === undefined || img.availableAt > simTime) continue;
    raw.push({ time: img.availableAt, event: { kind: 'imaging', data: img } });
  }

  raw.sort((a, b) => a.time - b.time);

  const groups: TimeGroup[] = [];
  for (const { time, event } of raw) {
    const last = groups[groups.length - 1];
    if (last && last.time === time) last.events.push(event);
    else groups.push({ time, events: [event] });
  }
  return groups;
}

function buildPending(medicalCase: MedicalCase, simTime: number) {
  const items: { name: string; availableAt: number }[] = [];
  for (const lab of medicalCase.labs ?? []) {
    if (lab.orderedAt === undefined) continue;
    if (lab.availableAt === undefined || lab.availableAt > simTime)
      items.push({ name: lab.name, availableAt: lab.availableAt ?? 0 });
  }
  for (const img of medicalCase.imaging ?? []) {
    if (img.orderedAt === undefined) continue;
    if (img.availableAt === undefined || img.availableAt > simTime)
      items.push({ name: img.type, availableAt: img.availableAt ?? 0 });
  }
  return items.sort((a, b) => a.availableAt - b.availableAt);
}

function activeMeds(medicalCase: MedicalCase) {
  return (medicalCase.medications ?? []).filter(m => m.discontinuedAt === undefined);
}

// ── Time divider ───────────────────────────────────────────────────────────────
function TimeDivider({ time }: { time: number }) {
  const d = Math.floor(time / 1440);
  const h = Math.floor((time % 1440) / 60);
  const m = time % 60;
  const label = d > 0
    ? `Day ${d + 1}  ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `T+${time}m`;
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-[10px] font-mono text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ── Lab result row ─────────────────────────────────────────────────────────────
function LabRow({ lab }: { lab: LabResult }) {
  const isCrit = lab.status === 'critical';
  const isAbn  = lab.status === 'abnormal';
  return (
    <div className={cn('flex items-baseline justify-between py-0.5', isCrit && 'bg-red-50 -mx-2 px-2 rounded')}>
      <span className="text-sm text-gray-700">{lab.name}</span>
      <span className={cn('font-mono text-sm tabular-nums',
        isCrit ? 'font-bold text-red-600' : isAbn ? 'text-red-500' : 'text-gray-900'
      )}>
        {lab.value} {lab.unit}
        {isCrit && <span className="ml-1 text-[10px]">⚠</span>}
        {isAbn && !isCrit && <span className="ml-1 text-[10px] text-red-400">↑</span>}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ClinicalTimeline({
  medicalCase, simTime, intervening,
  gcsState, onGcsChange, onExamineSystem, onDiscontinueMedication,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gcsOpen, setGcsOpen] = useState(false);
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState<string | null>(null);
  const [expandedImaging, setExpandedImaging] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const groups  = buildGroups(medicalCase, simTime);
  const pending = buildPending(medicalCase, simTime);
  const meds    = activeMeds(medicalCase);

  const gcsTotal = gcsState.eyes + gcsState.verbal + gcsState.motor;
  const v = medicalCase.vitals;
  const trend = medicalCase.physiologicalTrend;
  const pmh = medicalCase.pastMedicalHistory ?? [];
  const genderAbbr = medicalCase.gender?.toLowerCase().includes('f') ? 'F' : 'M';
  const examEntries = Object.entries(medicalCase.physicalExam ?? {}).filter(([k]) => k !== 'examined');

  // Auto-scroll to bottom when new events appear
  const eventCount = groups.reduce((n, g) => n + g.events.length, 0) + pending.length;
  useEffect(() => {
    if (eventCount > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = eventCount;
  }, [eventCount]);

  const handleExamine = async (system: string, currentFinding: string) => {
    if (revealedFindings[system]) return;
    if (currentFinding && currentFinding !== LOCKED_SENTINEL) {
      setRevealedFindings(prev => ({ ...prev, [system]: currentFinding }));
      onExamineSystem(system, currentFinding);
      return;
    }
    setLoadingSystem(system);
    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getSupabase } = await import('../lib/supabase');
        const sb = getSupabase();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch {}
      const res = await fetch('/api/examine-system', {
        method: 'POST', headers,
        body: JSON.stringify({ caseId: medicalCase.id, system }),
      });
      const finding = res.ok ? (await res.json()).finding : 'Examination performed — findings documented.';
      setRevealedFindings(prev => ({ ...prev, [system]: finding }));
      onExamineSystem(system, finding);
    } catch {
      const fallback = 'Examination performed — findings documented.';
      setRevealedFindings(prev => ({ ...prev, [system]: fallback }));
      onExamineSystem(system, fallback);
    } finally { setLoadingSystem(null); }
  };

  const toggleImaging = (key: string) =>
    setExpandedImaging(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="pb-4">

      {/* ── Patient card (T+0) ─────────────────────────────────────────────── */}
      <div className="mb-2">

        {/* Chief complaint — hero */}
        <p className="text-xl font-medium text-gray-900 leading-snug mb-2">
          &ldquo;{medicalCase.chiefComplaint}&rdquo;
        </p>

        {/* Demographics */}
        <p className="text-sm text-gray-400 mb-3">
          {medicalCase.age}{genderAbbr} · {medicalCase.currentLocation}
        </p>

        {/* Initial appearance */}
        {medicalCase.initialAppearance && (
          <p className="text-sm text-gray-500 italic leading-relaxed border-l-2 border-gray-200 pl-3 mb-4">
            {medicalCase.initialAppearance}
          </p>
        )}

        {/* Vitals */}
        <div className="space-y-0.5 mb-1">
          <p className="text-sm font-mono text-gray-700">
            HR {v.heartRate} · BP {v.bloodPressure} · SpO2 {v.oxygenSaturation}% · RR {v.respiratoryRate} · {v.temperature}°C
          </p>
          {v.heightCm != null && v.weightKg != null && (
            <p className="text-xs font-mono text-gray-400">
              {v.heightCm}cm · {v.weightKg}kg{v.bmi != null ? ` · BMI ${v.bmi.toFixed(1)}` : ''}
            </p>
          )}
        </div>

        {/* Trend badge */}
        {trend && trend !== 'stable' && (
          <span className={cn('inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            trend === 'improving' ? 'bg-green-50 text-green-600' :
            trend === 'declining' ? 'bg-amber-50 text-amber-600' :
            'bg-red-50 text-red-600 animate-pulse'
          )}>
            {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '⚠ Critical'}
          </span>
        )}

        {/* History — collapsible */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setHistoryOpen(p => !p)} className="flex items-center justify-between w-full mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">History</span>
            <span className="text-[10px] text-gray-300">{historyOpen ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pb-2 space-y-4">
                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{medicalCase.historyOfPresentIllness}</p>
                  {pmh.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">PMH</p>
                      <ul className="space-y-0.5">{pmh.map((item, i) => <li key={i} className="text-sm text-gray-700">{item}</li>)}</ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Physical exam — tap to reveal */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Exam</p>
          {examEntries.map(([key, finding]) => {
            const revealed = !!revealedFindings[key];
            const loading  = loadingSystem === key;
            const label    = key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <div key={key} className="py-2.5 border-b border-gray-50 last:border-0">
                <button onClick={() => handleExamine(key, finding as string)} disabled={revealed || loading} className="w-full text-left">
                  {revealed ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{revealedFindings[key]}</p>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">{label}</span>
                      <span className="text-xs text-gray-300">{loading ? 'Examining…' : 'Tap to examine'}</span>
                    </div>
                  )}
                </button>
              </div>
            );
          })}

          {/* GCS */}
          <div className="pt-3">
            <button onClick={() => setGcsOpen(p => !p)} className="flex items-center justify-between w-full">
              <span className="text-sm text-gray-400">GCS</span>
              <span className="text-sm font-mono text-gray-700">E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} = {gcsTotal}</span>
            </button>
            {gcsOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-3 mt-2">
                {(['eyes', 'verbal', 'motor'] as const).map(cat => (
                  <div key={cat}>
                    <p className="text-xs text-gray-400 mb-1 capitalize">{cat}</p>
                    <select value={gcsState[cat]} onChange={e => onGcsChange(cat, Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400">
                      {GCS_MAPPING[cat].map(o => <option key={o.score} value={o.score}>{o.score} — {o.label}</option>)}
                    </select>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chronological timeline ─────────────────────────────────────────── */}
      {groups.map(group => (
        <div key={group.time}>
          <TimeDivider time={group.time} />

          <div className="space-y-1">
            {group.events.map((event, i) => {
              if (event.kind === 'action') {
                return (
                  <p key={event.id} className="text-sm text-gray-500 leading-relaxed">
                    {event.description}
                  </p>
                );
              }

              if (event.kind === 'lab') {
                return <LabRow key={`lab-${event.data.name}-${group.time}`} lab={event.data} />;
              }

              if (event.kind === 'imaging') {
                const img = event.data;
                const key = `img-${img.type}-${group.time}`;
                const expanded = expandedImaging.has(key);
                return (
                  <div key={key}>
                    <button onClick={() => toggleImaging(key)} className="flex items-baseline justify-between w-full py-0.5 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors">
                      <span className="text-sm text-gray-700">{img.type}</span>
                      <span className="text-xs text-gray-400">{expanded ? '▲' : '▼ Report'}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="bg-gray-50 rounded-lg p-3 mt-1 mb-1 space-y-2">
                            {img.findings && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{img.findings}</p>}
                            {img.impression && <p className="text-sm font-medium text-gray-900 border-t border-gray-200 pt-2">{img.impression}</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      ))}

      {/* ── Pending results ────────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-mono text-gray-300">pending</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="space-y-1">
            {pending.map(p => (
              <div key={p.name} className="flex items-baseline justify-between">
                <span className="text-sm text-gray-300">{p.name}</span>
                <span className="text-xs text-gray-300">T+{p.availableAt}m</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Active medications ─────────────────────────────────────────────── */}
      {meds.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Active Medications</p>
          <div className="space-y-1">
            {meds.map(med => (
              <div key={med.id} className="group flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-gray-700">{med.name}</p>
                  {(med.dose || med.route) && (
                    <p className="text-[10px] text-gray-400">{[med.dose, med.route].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <button
                  onClick={() => onDiscontinueMedication(med.id, med.name)}
                  disabled={intervening}
                  className="text-[10px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                >
                  D/C
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
