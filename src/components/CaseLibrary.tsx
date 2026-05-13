import React, { useMemo, useState, useEffect } from 'react';
import {
  Heart, HeartPulse, Activity, Wind, AlertTriangle, Droplets, Droplet, Plus, RefreshCw,
  Loader2, Baby, Microscope, Stethoscope as StethoscopeIcon,
  FlaskConical as FlaskIcon, Brain, Syringe, Crosshair, Truck, Building2,
  Search, X, GitBranch, Zap, Bug, Bone, Eye, Ear, Dna,
  Shield, Feather, Dumbbell, Sparkles, Accessibility, TestTubes,
  Play, CheckCircle2, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRecentSimulations } from '../services/storageService';
import { cn } from '../lib/utils';

interface CaseLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (difficulty: string, category: string, environment: string) => void;
}

// ── Specialty catalog ─────────────────────────────────────────────────────────
interface Specialty {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SpecialtyGroup {
  id: string;
  label: string;
  specialties: Specialty[];
}

const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  {
    id: 'cardio_resp',
    label: 'Cardiovascular & Respiratory',
    specialties: [
      { id: 'cardiology',       label: 'Cardiology',        icon: <Heart className="w-4 h-4" /> },
      { id: 'pulmonology',      label: 'Pulmonology',       icon: <Wind className="w-4 h-4" /> },
      { id: 'vascular_surgery', label: 'Vascular Surgery',  icon: <GitBranch className="w-4 h-4" /> },
      { id: 'cardiothoracic',   label: 'Cardiothoracic',    icon: <HeartPulse className="w-4 h-4" /> },
    ],
  },
  {
    id: 'neuro',
    label: 'Neurosciences',
    specialties: [
      { id: 'neurology',     label: 'Neurology',     icon: <Brain className="w-4 h-4" /> },
      { id: 'neurosurgery',  label: 'Neurosurgery',  icon: <Activity className="w-4 h-4" /> },
      { id: 'psychiatry',    label: 'Psychiatry',    icon: <Brain className="w-4 h-4 text-clinical-amber" /> },
      { id: 'pain_medicine', label: 'Pain Medicine', icon: <Zap className="w-4 h-4" /> },
    ],
  },
  {
    id: 'internal',
    label: 'Internal Medicine',
    specialties: [
      { id: 'gastroenterology',    label: 'Gastroenterology',      icon: <StethoscopeIcon className="w-4 h-4" /> },
      { id: 'gi_hepatology',       label: 'GI & Hepatology',       icon: <StethoscopeIcon className="w-4 h-4" /> },
      { id: 'nephrology',          label: 'Nephrology',            icon: <Droplet className="w-4 h-4" /> },
      { id: 'endocrinology',       label: 'Endocrinology',         icon: <Syringe className="w-4 h-4" /> },
      { id: 'hematology_oncology', label: 'Haematology/Oncology',  icon: <Dna className="w-4 h-4" /> },
      { id: 'rheumatology',        label: 'Rheumatology',          icon: <Bone className="w-4 h-4" /> },
      { id: 'allergy_immunology',  label: 'Allergy/Immunology',    icon: <Shield className="w-4 h-4" /> },
      { id: 'dermatology',         label: 'Dermatology',           icon: <Sparkles className="w-4 h-4" /> },
      { id: 'geriatrics',          label: 'Geriatrics',            icon: <Accessibility className="w-4 h-4" /> },
    ],
  },
  {
    id: 'infect_crit',
    label: 'Infectious & Critical',
    specialties: [
      { id: 'infectious_disease', label: 'Infectious Disease', icon: <Bug className="w-4 h-4" /> },
      { id: 'sepsis',             label: 'Sepsis/Shock',       icon: <AlertTriangle className="w-4 h-4" /> },
      { id: 'toxicology',         label: 'Toxicology',         icon: <FlaskIcon className="w-4 h-4" /> },
      { id: 'critical_care',      label: 'Critical Care/ICU',  icon: <Activity className="w-4 h-4" /> },
    ],
  },
  {
    id: 'surg_trauma',
    label: 'Surgery & Trauma',
    specialties: [
      { id: 'trauma',         label: 'Trauma/Surgery', icon: <Droplets className="w-4 h-4" /> },
      { id: 'orthopaedics',   label: 'Orthopaedics',   icon: <Bone className="w-4 h-4" /> },
      { id: 'urology',        label: 'Urology',        icon: <TestTubes className="w-4 h-4" /> },
      { id: 'sports_medicine',label: 'Sports Medicine',icon: <Dumbbell className="w-4 h-4" /> },
    ],
  },
  {
    id: 'sensory_hn',
    label: 'Sensory & Head/Neck',
    specialties: [
      { id: 'ophthalmology', label: 'Ophthalmology', icon: <Eye className="w-4 h-4" /> },
      { id: 'ent',           label: 'ENT',           icon: <Ear className="w-4 h-4" /> },
    ],
  },
  {
    id: 'lifecycle',
    label: 'Women, Children & Lifecycle',
    specialties: [
      { id: 'obgyn',           label: 'OB/GYN',          icon: <Microscope className="w-4 h-4" /> },
      { id: 'pediatrics',      label: 'Paediatrics',     icon: <Baby className="w-4 h-4" /> },
      { id: 'neonatology',     label: 'Neonatology',     icon: <Baby className="w-4 h-4 text-clinical-blue" /> },
      { id: 'palliative_care', label: 'Palliative Care', icon: <Feather className="w-4 h-4" /> },
    ],
  },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────
type LibraryTab = 'practice' | 'generate';

export function CaseLibrary({ isOpen, onClose, onSelectCase }: CaseLibraryProps) {
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('resident');
  const [selectedEnv, setSelectedEnv] = useState('tertiary');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLibTab, setActiveLibTab] = useState<LibraryTab>('practice');

  useEffect(() => {
    if (isOpen) {
      setLoadingRecent(true);
      getRecentSimulations()
        .then(setRecentCases)
        .finally(() => setLoadingRecent(false));
    }
  }, [isOpen]);

  const difficulties = [
    { id: 'intern', label: 'Intern', desc: 'Clear clinical signs, classic presentations.' },
    { id: 'resident', label: 'Resident', desc: 'Mixed clues, requires differential thinking.' },
    { id: 'attending', label: 'Attending', desc: 'Subtle clues, complex co-morbidities.' },
  ];

  const environments = [
    { id: 'tertiary', label: 'Tertiary Care', icon: <Building2 className="w-4 h-4" />, desc: 'Full resources, Level 1 Trauma.' },
    { id: 'rural', label: 'Rural Clinic', icon: <Crosshair className="w-4 h-4" />, desc: 'Limited labs/imaging, slow results.' },
    { id: 'prehospital', label: 'EMS Environment', icon: <Truck className="w-4 h-4" />, desc: 'Field setting, monitor only.' },
  ];

  const handleSelectSpecialty = (id: string) => onSelectCase(selectedDifficulty, id, selectedEnv);

  // ── Search filtering ────────────────────────────────────────────────────────
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isFiltering = trimmedQuery.length > 0;

  const filteredFlatList: Specialty[] = useMemo(() => {
    if (!isFiltering) return [];
    return SPECIALTY_GROUPS.flatMap(g => g.specialties).filter(s =>
      s.label.toLowerCase().includes(trimmedQuery)
    );
  }, [isFiltering, trimmedQuery]);

  // Filter recent cases by search
  const filteredRecent = useMemo(() => {
    if (!trimmedQuery) return recentCases;
    return recentCases.filter(rc =>
      (rc.patient_name || '').toLowerCase().includes(trimmedQuery) ||
      (rc.category || '').toLowerCase().includes(trimmedQuery) ||
      (rc.correct_diagnosis || '').toLowerCase().includes(trimmedQuery)
    );
  }, [recentCases, trimmedQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-clinical-ink/60 backdrop-blur-sm z-[100]"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label="Clinical Case Library"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-clinical-surface rounded-lg shadow-2xl z-[101] overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* ── Header ── */}
            <div className="bg-clinical-ink text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold">Try a Case</h2>
                <p className="text-[10px] text-white/50 mt-0.5">Practice or generate a new simulation</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close case library"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tab bar ── */}
            <div className="flex border-b border-clinical-line shrink-0 bg-clinical-bg/50">
              <button
                onClick={() => setActiveLibTab('practice')}
                className={cn(
                  'px-5 py-3 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2',
                  activeLibTab === 'practice'
                    ? 'text-clinical-ink border-clinical-teal'
                    : 'text-clinical-slate border-transparent hover:text-clinical-ink'
                )}
              >
                Practice
              </button>
              <button
                onClick={() => setActiveLibTab('generate')}
                className={cn(
                  'px-5 py-3 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2',
                  activeLibTab === 'generate'
                    ? 'text-clinical-ink border-clinical-teal'
                    : 'text-clinical-slate border-transparent hover:text-clinical-ink'
                )}
              >
                Generate New
              </button>
            </div>

            {/* ── Practice Tab (Healer-style table) ── */}
            {activeLibTab === 'practice' && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-5">
                  {/* Search */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-clinical-ink">PRACTICE</h3>
                    <div className="relative w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/50" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        className="w-full pl-9 pr-3 py-2 bg-clinical-bg border border-clinical-line rounded-lg text-xs focus:outline-none focus:border-clinical-blue/50"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  {loadingRecent ? (
                    <div className="flex items-center justify-center py-12 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-clinical-blue" />
                      <span className="text-xs text-clinical-slate">Loading history...</span>
                    </div>
                  ) : filteredRecent.length > 0 ? (
                    <div className="border border-clinical-line rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-clinical-bg/50 border-b border-clinical-line">
                            <th className="px-4 py-3 text-[10px] font-bold text-clinical-slate uppercase tracking-wider">Case</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-clinical-blue uppercase tracking-wider">Chief Concern</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-clinical-slate uppercase tracking-wider text-center">Score</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-clinical-slate uppercase tracking-wider text-center">Time</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-clinical-slate uppercase tracking-wider text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecent.map((rc, i) => (
                            <tr key={i} className="border-b border-clinical-line/50 last:border-b-0 hover:bg-clinical-bg/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-clinical-bg border border-clinical-line flex items-center justify-center text-clinical-slate/50">
                                    <StethoscopeIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-clinical-ink">{rc.patient_name || 'Unknown'}</p>
                                    <p className="text-[10px] text-clinical-slate capitalize">{rc.difficulty || 'resident'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-clinical-ink capitalize">{rc.category?.replace(/_/g, ' ') || 'General'}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  'text-xs font-bold px-2 py-0.5 rounded',
                                  rc.score >= 80 ? 'text-clinical-green bg-green-50' :
                                  rc.score >= 60 ? 'text-clinical-amber bg-amber-50' :
                                  'text-clinical-red bg-red-50'
                                )}>
                                  {rc.score}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-[10px] text-clinical-slate">
                                  {rc.simulation_time ? `${rc.simulation_time}m` : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => onSelectCase(rc.difficulty || 'resident', rc.category || 'any', 'tertiary')}
                                  className="p-1.5 text-clinical-blue hover:bg-clinical-blue/10 rounded transition-colors"
                                  title="Try similar case"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-16 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-clinical-bg border border-clinical-line flex items-center justify-center">
                        <StethoscopeIcon className="w-5 h-5 text-clinical-slate/30" />
                      </div>
                      <p className="text-sm text-clinical-slate/70">No completed cases yet</p>
                      <p className="text-xs text-clinical-slate/50">Generate a new case to start practicing</p>
                      <button
                        onClick={() => setActiveLibTab('generate')}
                        className="mt-3 px-4 py-2 bg-clinical-blue text-white rounded-lg text-xs font-medium hover:bg-clinical-blue/90 transition-colors"
                      >
                        Generate New Case
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick generate row at bottom */}
                <div className="border-t border-clinical-line p-4 bg-clinical-bg/30">
                  <button
                    onClick={() => onSelectCase(selectedDifficulty, 'any', selectedEnv)}
                    className="w-full p-3 rounded-lg border border-dashed border-clinical-blue/30 hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all flex items-center justify-center gap-2 group"
                  >
                    <RefreshCw className="w-4 h-4 text-clinical-blue group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-xs font-medium text-clinical-blue">Quick Generate — Random Case</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Generate Tab (specialty picker) ── */}
            {activeLibTab === 'generate' && (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-4">
                  {/* Sidebar config */}
                  <div className="p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-clinical-line bg-clinical-bg/30 space-y-5">
                    <div>
                      <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3">Difficulty</h3>
                      <div className="space-y-1.5">
                        {difficulties.map(d => (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDifficulty(d.id)}
                            aria-pressed={selectedDifficulty === d.id}
                            className={cn(
                              "w-full text-left p-2.5 rounded-lg border transition-all",
                              selectedDifficulty === d.id
                                ? "bg-clinical-blue text-white border-clinical-blue"
                                : "bg-clinical-surface border-clinical-line hover:border-clinical-blue/40 text-clinical-ink"
                            )}
                          >
                            <div className="font-bold text-[10px] uppercase tracking-wider">{d.label}</div>
                            <div className={cn("text-[9px] leading-tight mt-0.5", selectedDifficulty === d.id ? "text-white/70" : "text-clinical-slate/60")}>{d.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3">Environment</h3>
                      <div className="space-y-1.5">
                        {environments.map(e => (
                          <button
                            key={e.id}
                            onClick={() => setSelectedEnv(e.id)}
                            aria-pressed={selectedEnv === e.id}
                            className={cn(
                              "w-full text-left p-2.5 rounded-lg border transition-all",
                              selectedEnv === e.id
                                ? "bg-clinical-ink text-white border-clinical-ink"
                                : "bg-clinical-surface border-clinical-line hover:border-clinical-ink/40 text-clinical-ink"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {e.icon}
                              <div className="font-bold text-[10px] uppercase tracking-wider">{e.label}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Specialty grid */}
                  <div className="lg:col-span-3 p-4 md:p-5">
                    {/* Search */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/50" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter specialties…"
                        className="w-full pl-9 pr-8 py-2 bg-clinical-bg border border-clinical-line rounded-lg text-xs focus:outline-none focus:border-clinical-blue/50"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-clinical-slate/50 hover:text-clinical-slate">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isFiltering ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {filteredFlatList.map(s => (
                          <button
                            key={s.id}
                            onClick={() => handleSelectSpecialty(s.id)}
                            className="p-3 rounded-lg border border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-left group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="text-clinical-blue">{s.icon}</div>
                              <span className="text-xs font-medium text-clinical-ink group-hover:text-clinical-blue">{s.label}</span>
                            </div>
                          </button>
                        ))}
                        {filteredFlatList.length === 0 && (
                          <div className="col-span-full py-8 text-center text-xs text-clinical-slate/50">
                            No specialties match "{searchQuery}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {SPECIALTY_GROUPS.map(group => (
                          <section key={group.id}>
                            <h4 className="text-[9px] font-bold text-clinical-slate/60 uppercase tracking-widest mb-2">{group.label}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {group.specialties.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => handleSelectSpecialty(s.id)}
                                  className="p-3 rounded-lg border border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-left group"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="text-clinical-blue">{s.icon}</div>
                                    <span className="text-xs font-medium text-clinical-ink group-hover:text-clinical-blue">{s.label}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}

                    {/* Random pick */}
                    <button
                      onClick={() => onSelectCase(selectedDifficulty, 'any', selectedEnv)}
                      className="mt-4 w-full p-3 rounded-lg border-2 border-dashed border-clinical-blue/30 hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-center group"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 text-clinical-blue group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-xs font-bold text-clinical-blue uppercase">Random Case</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
