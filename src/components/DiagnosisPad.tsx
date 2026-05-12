import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  Search,
  Plus,
  Star,
  PenTool,
  Lightbulb,
  FileSearch,
  History as HistoryIcon,
  Grid3x3,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type {
  ClinicalFinding,
  DifferentialEntry,
  IllnessScript,
  PRSnapshot,
  WorkflowStage,
} from '../types';
import { IllnessScriptEditor } from './IllnessScriptEditor';
import { ReasoningTimeline } from './ReasoningTimeline';
import { FindingsMatrix } from './FindingsMatrix';

// ── Common diagnosis suggestions for search ──────────────────────────────────
const DIAGNOSIS_DATABASE = [
  'Acute Coronary Syndrome', 'STEMI', 'NSTEMI', 'Unstable Angina',
  'Pulmonary Embolism', 'Pneumonia', 'COPD Exacerbation', 'Pneumothorax',
  'Sepsis', 'Septic Shock', 'DKA', 'HHS',
  'Stroke (Ischemic)', 'Stroke (Hemorrhagic)', 'TIA', 'Subarachnoid Hemorrhage',
  'Heart Failure (Acute)', 'Atrial Fibrillation', 'Aortic Dissection',
  'Anaphylaxis', 'Asthma Exacerbation', 'Tension Pneumothorax',
  'GI Bleed (Upper)', 'GI Bleed (Lower)', 'Appendicitis', 'Pancreatitis',
  'Meningitis', 'Encephalitis', 'Status Epilepticus',
  'Hypertensive Emergency', 'Pericardial Tamponade',
  'Acute Kidney Injury', 'Rhabdomyolysis',
  'Serotonin Syndrome', 'Neuroleptic Malignant Syndrome',
  'Thyroid Storm', 'Adrenal Crisis',
  'Trauma (Blunt)', 'Trauma (Penetrating)', 'Hemorrhagic Shock',
  'Drug Overdose', 'Acetaminophen Toxicity', 'Opioid Overdose',
  'COVID-19', 'Influenza', 'Endocarditis',
  'Deep Vein Thrombosis', 'Compartment Syndrome',
];

export interface DiagnosisPadProps {
  isOpen: boolean;
  onToggle: () => void;
  /** What sub-tab to show when opening the pad. Optional external control. */
  initialTab?: PadTab;

  // ── Problem Representation ──────────────────────────────────────────────
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;

  // ── Problem Representation history (timeline) ──────────────────────────
  prHistory: PRSnapshot[];
  prIsDirty: boolean;
  currentStage: WorkflowStage;

  // ── Differential ───────────────────────────────────────────────────────
  differentials: DifferentialEntry[];
  onAddDifferential: (diagnosis: string) => void;
  onRemoveDifferential: (id: string) => void;
  onSetLeadDiagnosis: (id: string) => void;
  onUpdateConfidence: (
    id: string,
    confidence: 'high' | 'moderate' | 'low',
  ) => void;
  onSetIllnessScript: (id: string, script: IllnessScript) => void;

  // ── Findings ───────────────────────────────────────────────────────────
  findings: ClinicalFinding[];
  onRemoveFinding: (id: string) => void;
  onUpdateRelevance: (
    id: string,
    relevance: 'positive' | 'negative' | 'none',
  ) => void;
  onUpdateFindingRelevanceForDx: (
    findingId: string,
    differentialId: string,
    relevance: 'positive' | 'negative' | 'none',
  ) => void;
}

export type PadTab = 'pr' | 'ddx' | 'findings' | 'matrix' | 'timeline';

export function DiagnosisPad({
  isOpen,
  onToggle,
  initialTab,
  problemRepresentation,
  onProblemRepresentationChange,
  prHistory,
  prIsDirty,
  currentStage,
  differentials,
  onAddDifferential,
  onRemoveDifferential,
  onSetLeadDiagnosis,
  onUpdateConfidence,
  onSetIllnessScript,
  findings,
  onRemoveFinding,
  onUpdateRelevance,
  onUpdateFindingRelevanceForDx,
}: DiagnosisPadProps) {
  const [activeTab, setActiveTab] = useState<PadTab>(initialTab ?? 'pr');
  const [ddxSearch, setDdxSearch] = useState('');

  // Sync with externally-driven tab changes (e.g. clicking a nudge)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const filteredDiagnoses =
    ddxSearch.trim().length >= 2
      ? DIAGNOSIS_DATABASE.filter(
          d =>
            d.toLowerCase().includes(ddxSearch.toLowerCase()) &&
            !differentials.some(dd => dd.diagnosis === d),
        ).slice(0, 8)
      : [];

  // ── Collapsed toggle button ────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-teal-600 hover:bg-teal-700 text-white px-2 py-4 rounded-l-lg shadow-lg transition-all flex flex-col items-center gap-1"
        aria-label="Open Diagnosis Pad"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
          Dx Pad
        </span>
      </button>
    );
  }

  const linkedFindingsCount = findings.filter(
    f => f.relevanceByDx && Object.keys(f.relevanceByDx).length > 0,
  ).length;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[360px] bg-white dark:bg-clinical-surface border-l-2 border-teal-500 shadow-2xl z-50 flex flex-col"
      role="complementary"
      aria-label="Diagnosis Pad"
    >
      {/* ── Header ── */}
      <div className="h-12 bg-teal-600 text-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">DIAGNOSIS PAD</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-teal-700 rounded-md transition-colors"
          aria-label="Collapse"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tab switches ── */}
      <div className="flex border-b border-clinical-line shrink-0 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'pr' as PadTab, label: 'PR', icon: <PenTool className="w-3 h-3" /> },
            { id: 'ddx' as PadTab, label: 'DDx', icon: <Star className="w-3 h-3" />, badge: differentials.length },
            { id: 'findings' as PadTab, label: 'Findings', icon: <FileSearch className="w-3 h-3" />, badge: findings.length },
            { id: 'matrix' as PadTab, label: 'Matrix', icon: <Grid3x3 className="w-3 h-3" />, badge: linkedFindingsCount },
            { id: 'timeline' as PadTab, label: 'Timeline', icon: <HistoryIcon className="w-3 h-3" />, badge: prHistory.length },
          ]
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 min-w-[64px] py-2 text-[10px] font-semibold transition-colors relative flex flex-col items-center gap-0.5',
              activeTab === tab.id
                ? 'text-teal-700 border-b-2 border-teal-500 bg-teal-50/50'
                : 'text-clinical-slate hover:text-clinical-ink hover:bg-clinical-bg/50',
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="flex items-center gap-1">
              {tab.icon}
              {tab.label}
            </span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 text-[8px] font-bold bg-teal-600 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ── Problem Representation ── */}
        {activeTab === 'pr' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                <PenTool className="w-3 h-3" />
                Update your problem representation
              </label>
              {prIsDirty && prHistory.length > 0 && (
                <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  Uncommitted
                </span>
              )}
            </div>
            <p className="text-[10px] text-clinical-slate leading-relaxed">
              Summarize the key patient features in 1-2 sentences. Update it as
              you gather more data — the Timeline tab will show every version
              you've committed.
            </p>
            <textarea
              value={problemRepresentation}
              onChange={e => onProblemRepresentationChange(e.target.value)}
              placeholder="A [age]-year-old [gender] presents with [chief complaint], [key features], concerning for [suspected diagnosis]..."
              className="w-full h-32 bg-clinical-bg border border-clinical-line rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
              aria-label="Problem representation"
            />
            <div className="text-[10px] text-clinical-slate/60 text-right">
              {problemRepresentation.length} characters
            </div>
          </div>
        )}

        {/* ── Differential Diagnosis Builder ── */}
        {activeTab === 'ddx' && (
          <div className="space-y-3 animate-in fade-in">
            <label className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">
              Build your differential
              <span className="ml-2 text-clinical-slate font-normal">
                Count: {differentials.length}
              </span>
            </label>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/50" />
              <input
                type="text"
                value={ddxSearch}
                onChange={e => setDdxSearch(e.target.value)}
                placeholder="Start typing a diagnosis..."
                className="w-full pl-9 pr-3 py-2.5 bg-clinical-bg border border-clinical-line rounded-lg text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                aria-label="Search diagnoses"
              />
            </div>

            {/* Search results */}
            <AnimatePresence>
              {filteredDiagnoses.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border border-clinical-line rounded-lg overflow-hidden"
                >
                  {filteredDiagnoses.map(dx => (
                    <button
                      key={dx}
                      onClick={() => {
                        onAddDifferential(dx);
                        setDdxSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 text-clinical-ink transition-colors flex items-center gap-2 border-b border-clinical-line/50 last:border-b-0"
                    >
                      <Plus className="w-3 h-3 text-teal-500 shrink-0" />
                      {dx}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom add */}
            {ddxSearch.trim().length >= 3 && filteredDiagnoses.length === 0 && (
              <button
                onClick={() => {
                  onAddDifferential(ddxSearch.trim());
                  setDdxSearch('');
                }}
                className="w-full text-left px-3 py-2.5 text-xs bg-teal-50 border border-teal-200 rounded-lg text-teal-700 font-medium hover:bg-teal-100 transition-colors flex items-center gap-2"
              >
                <Plus className="w-3 h-3" />
                Add "{ddxSearch.trim()}"
              </button>
            )}

            {/* Current differential list */}
            <div className="space-y-2 mt-2">
              {differentials.length === 0 ? (
                <p className="text-xs text-clinical-slate/50 italic text-center py-4">
                  No diagnoses added yet. Search above to add.
                </p>
              ) : (
                differentials.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-lg border transition-all',
                      entry.isLead
                        ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                        : 'bg-clinical-bg/50 border-clinical-line',
                    )}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-[10px] font-mono text-clinical-slate/50 w-4">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-xs font-medium truncate',
                            entry.isLead && 'text-teal-700',
                          )}
                        >
                          {entry.diagnosis}
                        </p>
                      </div>
                      <button
                        onClick={() => onSetLeadDiagnosis(entry.id)}
                        className={cn(
                          'p-1 rounded transition-colors',
                          entry.isLead
                            ? 'text-teal-600'
                            : 'text-clinical-slate/30 hover:text-teal-500',
                        )}
                        title={entry.isLead ? 'Lead diagnosis' : 'Set as lead'}
                        aria-label={
                          entry.isLead
                            ? 'Current lead diagnosis'
                            : 'Set as lead diagnosis'
                        }
                      >
                        <Star
                          className={cn('w-3.5 h-3.5', entry.isLead && 'fill-current')}
                        />
                      </button>
                      <select
                        value={entry.confidence}
                        onChange={e =>
                          onUpdateConfidence(entry.id, e.target.value as any)
                        }
                        className="text-[10px] bg-transparent border-none outline-none text-clinical-slate cursor-pointer"
                        aria-label="Confidence level"
                      >
                        <option value="high">High</option>
                        <option value="moderate">Mod</option>
                        <option value="low">Low</option>
                      </select>
                      <button
                        onClick={() => onRemoveDifferential(entry.id)}
                        className="p-1 text-clinical-slate/30 hover:text-red-500 transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="px-3 pb-2.5">
                      <IllnessScriptEditor
                        differential={entry}
                        findings={findings}
                        onChange={script =>
                          onSetIllnessScript(entry.id, script)
                        }
                        defaultOpen={entry.isLead}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Findings Tracker ── */}
        {activeTab === 'findings' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                <FileSearch className="w-3 h-3" />
                Review your selected findings
              </label>
              <span className="text-[10px] text-clinical-slate font-mono">
                Count: {findings.length}
              </span>
            </div>

            {findings.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <FileSearch className="w-8 h-8 text-clinical-slate/20 mx-auto" />
                <p className="text-xs text-clinical-slate/50">
                  Findings will appear here as you examine the patient, order
                  labs, and review imaging.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {findings.map(f => {
                  const linkedCount = f.relevanceByDx
                    ? Object.keys(f.relevanceByDx).length
                    : 0;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 px-3 py-2 bg-clinical-bg/50 border border-clinical-line rounded-lg"
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          f.source === 'exam'
                            ? 'bg-blue-400'
                            : f.source === 'lab'
                            ? 'bg-green-400'
                            : f.source === 'imaging'
                            ? 'bg-purple-400'
                            : f.source === 'vitals'
                            ? 'bg-red-400'
                            : 'bg-clinical-slate/40',
                        )}
                      />
                      <span className="text-xs text-clinical-ink flex-1 truncate">
                        {f.text}
                      </span>
                      {linkedCount > 0 && (
                        <span
                          className="text-[9px] font-medium text-teal-700 bg-teal-50 rounded px-1.5 py-0.5"
                          title={`Linked to ${linkedCount} differential${linkedCount === 1 ? '' : 's'}`}
                        >
                          {linkedCount}↔
                        </span>
                      )}
                      <select
                        value={f.relevance}
                        onChange={e =>
                          onUpdateRelevance(f.id, e.target.value as any)
                        }
                        className={cn(
                          'text-[10px] font-medium bg-transparent border-none outline-none cursor-pointer',
                          f.relevance === 'positive'
                            ? 'text-green-600'
                            : f.relevance === 'negative'
                            ? 'text-red-500'
                            : 'text-clinical-slate/60',
                        )}
                        aria-label="Finding relevance"
                      >
                        <option value="positive">Yes</option>
                        <option value="negative">No</option>
                        <option value="none">None</option>
                      </select>
                      <button
                        onClick={() => onRemoveFinding(f.id)}
                        className="p-0.5 text-clinical-slate/30 hover:text-red-500 transition-colors"
                        aria-label="Remove finding"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Source legend */}
            {findings.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-clinical-line/50">
                {[
                  { color: 'bg-red-400', label: 'Vitals' },
                  { color: 'bg-blue-400', label: 'Exam' },
                  { color: 'bg-green-400', label: 'Lab' },
                  { color: 'bg-purple-400', label: 'Imaging' },
                ].map(l => (
                  <span
                    key={l.label}
                    className="flex items-center gap-1 text-[9px] text-clinical-slate/60"
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full', l.color)} />
                    {l.label}
                  </span>
                ))}
              </div>
            )}
            {findings.length > 0 && differentials.length > 0 && (
              <button
                onClick={() => setActiveTab('matrix')}
                className="mt-2 w-full text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md py-1.5 hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Grid3x3 className="w-3 h-3" />
                Open Findings × Differentials matrix
              </button>
            )}
          </div>
        )}

        {/* ── Findings × Differentials matrix ── */}
        {activeTab === 'matrix' && (
          <div className="animate-in fade-in">
            <FindingsMatrix
              findings={findings}
              differentials={differentials}
              onUpdateCell={onUpdateFindingRelevanceForDx}
            />
          </div>
        )}

        {/* ── PR Timeline ── */}
        {activeTab === 'timeline' && (
          <div className="animate-in fade-in">
            <ReasoningTimeline
              prHistory={prHistory}
              currentDraft={problemRepresentation}
              currentStage={currentStage}
              isDirty={prIsDirty}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
