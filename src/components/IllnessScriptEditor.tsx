import { useState, useMemo, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Users,
  Clock,
  Target,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { DifferentialEntry, IllnessScript, ClinicalFinding } from '../types';

interface IllnessScriptEditorProps {
  differential: DifferentialEntry;
  /** All findings currently tracked — used to show "X of your expected
   *  features have been matched in the findings" reconciliation. */
  findings: ClinicalFinding[];
  onChange: (script: IllnessScript) => void;
  /** Start the editor collapsed or expanded. Defaults to collapsed. */
  defaultOpen?: boolean;
}

const EMPTY_SCRIPT: IllnessScript = {
  typicalDemographics: '',
  typicalTimeline: '',
  keyFeatures: [],
  discriminatingFeatures: [],
  expectedLabs: [],
};

/** A compact chip-list editor. Enter or comma commits the current draft. */
function ChipList({
  label,
  icon,
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  icon: React.ReactNode;
  items: string[];
  placeholder: string;
  onAdd: (val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const v = draft.trim();
    if (v) {
      onAdd(v);
      setDraft('');
    }
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    }
  }
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-clinical-slate uppercase tracking-wide mb-1.5">
        <span className="text-teal-600">{icon}</span>
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {items.map((item, idx) => (
          <span
            key={`${idx}-${item}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-800 text-[11px] font-medium rounded-md border border-teal-200"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${item}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-[10px] text-clinical-slate/50 italic">none yet</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 text-xs bg-clinical-bg border border-clinical-line rounded-md focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim().length === 0}
          className="px-2 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-clinical-line disabled:text-clinical-slate/50 text-white rounded-md transition-all"
          aria-label={`Add to ${label}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/** Loose token match: does any finding text contain this feature string? */
function matchesFindings(feature: string, findings: ClinicalFinding[]): boolean {
  const needle = feature.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (!needle) return false;
  return findings.some(f =>
    f.text.toLowerCase().replace(/[^\w\s]/g, '').includes(needle),
  );
}

export function IllnessScriptEditor({
  differential,
  findings,
  onChange,
  defaultOpen = false,
}: IllnessScriptEditorProps) {
  const [open, setOpen] = useState(defaultOpen);
  const script: IllnessScript = differential.illnessScript ?? EMPTY_SCRIPT;

  const update = (patch: Partial<IllnessScript>) =>
    onChange({ ...script, ...patch });

  // Fast feature-vs-findings reconciliation (client-side loose match)
  const reconciliation = useMemo(() => {
    const allExpected = [
      ...script.keyFeatures.map(f => ({ text: f, kind: 'key' as const })),
      ...script.discriminatingFeatures.map(f => ({ text: f, kind: 'discrim' as const })),
      ...script.expectedLabs.map(f => ({ text: f, kind: 'lab' as const })),
    ];
    if (allExpected.length === 0) return null;
    const matched = allExpected.filter(e => matchesFindings(e.text, findings));
    return { matched: matched.length, total: allExpected.length };
  }, [script, findings]);

  const hasAnyContent =
    !!script.typicalDemographics ||
    !!script.typicalTimeline ||
    script.keyFeatures.length > 0 ||
    script.discriminatingFeatures.length > 0 ||
    script.expectedLabs.length > 0;

  return (
    <div className="border-t border-clinical-line/60 mt-1.5 pt-1.5">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 text-[10px] font-semibold text-clinical-slate uppercase tracking-wide hover:text-teal-700 transition-colors"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <BookOpen className="w-3 h-3" />
        <span>Illness Script</span>
        {hasAnyContent && !open && (
          <span className="text-teal-600 normal-case font-normal">
            · {script.keyFeatures.length + script.discriminatingFeatures.length + script.expectedLabs.length} expected
          </span>
        )}
        {reconciliation && (
          <span
            className={cn(
              'ml-auto normal-case font-medium flex items-center gap-1',
              reconciliation.matched === reconciliation.total
                ? 'text-green-600'
                : reconciliation.matched > 0
                ? 'text-amber-600'
                : 'text-clinical-slate/60',
            )}
          >
            {reconciliation.matched === reconciliation.total && reconciliation.total > 0 ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {reconciliation.matched}/{reconciliation.total} matched
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-1 space-y-3">
              <p className="text-[10px] text-clinical-slate/70 leading-relaxed">
                Write down what you'd <em>expect</em> for {differential.diagnosis}. The
                app will compare expectations against the findings you've
                tracked so you can see where reality diverges from your
                mental model.
              </p>

              {/* Short-form demographics + timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-clinical-slate uppercase tracking-wide mb-1">
                    <Users className="w-3 h-3 text-teal-600" />
                    Typical Demographics
                  </label>
                  <input
                    type="text"
                    value={script.typicalDemographics ?? ''}
                    onChange={e => update({ typicalDemographics: e.target.value })}
                    placeholder="e.g., 40-60 yo with HTN, DM, prior smoker"
                    className="w-full px-2.5 py-1.5 text-xs bg-clinical-bg border border-clinical-line rounded-md focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-clinical-slate uppercase tracking-wide mb-1">
                    <Clock className="w-3 h-3 text-teal-600" />
                    Typical Timeline
                  </label>
                  <input
                    type="text"
                    value={script.typicalTimeline ?? ''}
                    onChange={e => update({ typicalTimeline: e.target.value })}
                    placeholder="e.g., sudden onset over minutes"
                    className="w-full px-2.5 py-1.5 text-xs bg-clinical-bg border border-clinical-line rounded-md focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                  />
                </div>
              </div>

              {/* Key features */}
              <ChipList
                label="Key Features (classic findings)"
                icon={<Target className="w-3 h-3" />}
                items={script.keyFeatures}
                placeholder="e.g., crushing substernal chest pain"
                onAdd={v => update({ keyFeatures: [...script.keyFeatures, v] })}
                onRemove={idx =>
                  update({
                    keyFeatures: script.keyFeatures.filter((_, i) => i !== idx),
                  })
                }
              />

              {/* Discriminating features */}
              <ChipList
                label="Discriminating Features (rule-in / rule-out)"
                icon={<Target className="w-3 h-3" />}
                items={script.discriminatingFeatures}
                placeholder="e.g., ST elevation, rising troponin"
                onAdd={v =>
                  update({
                    discriminatingFeatures: [...script.discriminatingFeatures, v],
                  })
                }
                onRemove={idx =>
                  update({
                    discriminatingFeatures: script.discriminatingFeatures.filter(
                      (_, i) => i !== idx,
                    ),
                  })
                }
              />

              {/* Expected labs/imaging */}
              <ChipList
                label="Expected Lab / Imaging Findings"
                icon={<FlaskConical className="w-3 h-3" />}
                items={script.expectedLabs}
                placeholder="e.g., elevated troponin, ECG with STE"
                onAdd={v =>
                  update({ expectedLabs: [...script.expectedLabs, v] })
                }
                onRemove={idx =>
                  update({
                    expectedLabs: script.expectedLabs.filter((_, i) => i !== idx),
                  })
                }
              />

              {/* Reconciliation summary (per-feature) */}
              {reconciliation && reconciliation.total > 0 && (
                <div className="border-t border-clinical-line/40 pt-2">
                  <p className="text-[10px] font-semibold text-clinical-slate uppercase mb-1.5">
                    Reconciliation with findings
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[...script.keyFeatures, ...script.discriminatingFeatures, ...script.expectedLabs].map(
                      (f, idx) => {
                        const matched = matchesFindings(f, findings);
                        return (
                          <span
                            key={`${idx}-${f}`}
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border',
                              matched
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-clinical-bg border-clinical-line text-clinical-slate/60',
                            )}
                          >
                            {matched ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <AlertCircle className="w-2.5 h-2.5" />
                            )}
                            {f}
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
