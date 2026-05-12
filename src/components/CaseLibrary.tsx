import React, { useState, useEffect } from 'react';
import {
  Heart, Activity, Wind, AlertTriangle, Droplets, Plus, RefreshCw,
  Loader2, Baby, Microscope, Stethoscope as StethoscopeIcon,
  FlaskConical as FlaskIcon, Brain, Syringe, Crosshair, Truck, Building2,
  Search, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRecentSimulations } from '../services/storageService';
import { cn } from '../lib/utils';

interface CaseLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (difficulty: string, category: string, environment: string) => void;
}

export function CaseLibrary({ isOpen, onClose, onSelectCase }: CaseLibraryProps) {
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('resident');
  const [selectedEnv, setSelectedEnv] = useState('tertiary');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoadingRecent(true);
      getRecentSimulations()
        .then(setRecentCases)
        .finally(() => setLoadingRecent(false));
    }
  }, [isOpen]);

  const categories = [
    { id: 'cardiology', label: 'Cardiology', icon: <Heart className="w-4 h-4" /> },
    { id: 'pulmonology', label: 'Pulmonology', icon: <Wind className="w-4 h-4" /> },
    { id: 'sepsis', label: 'Sepsis/Shock', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'trauma', label: 'Trauma/Surgical', icon: <Droplets className="w-4 h-4" /> },
    { id: 'neurology', label: 'Neurology', icon: <Activity className="w-4 h-4" /> },
    { id: 'toxicology', label: 'Toxicology', icon: <FlaskIcon className="w-4 h-4" /> },
    { id: 'pediatrics', label: 'Pediatrics', icon: <Baby className="w-4 h-4" /> },
    { id: 'obgyn', label: 'OB/GYN', icon: <Microscope className="w-4 h-4" /> },
    { id: 'gi_hepatology', label: 'GI & Hepatology', icon: <StethoscopeIcon className="w-4 h-4" /> },
    { id: 'endocrinology', label: 'Endocrinology', icon: <Syringe className="w-4 h-4" /> },
    { id: 'psychiatry', label: 'Psychiatry', icon: <Brain className="w-4 h-4" /> },
    { id: 'renal', label: 'Renal/Nephrology', icon: <Droplets className="w-4 h-4" /> },
    { id: 'heme_onc', label: 'Heme/Onc', icon: <Microscope className="w-4 h-4" /> },
    { id: 'musculoskeletal', label: 'MSK/Rheum', icon: <Activity className="w-4 h-4" /> },
    { id: 'infectious_disease', label: 'Infectious Disease', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'dermatology', label: 'Dermatology', icon: <StethoscopeIcon className="w-4 h-4" /> },
    { id: 'ent', label: 'ENT', icon: <StethoscopeIcon className="w-4 h-4" /> },
    { id: 'palliative', label: 'Palliative/Goals of Care', icon: <Heart className="w-4 h-4" /> },
  ];

  const difficulties = [
    { id: 'intern', label: 'Intern', desc: 'Clear clinical signs, classic presentations.' },
    { id: 'resident', label: 'Resident', desc: 'Mixed clues, requires differential thinking.' },
    { id: 'attending', label: 'Attending', desc: 'Subtle clues, complex co-morbidities.' },
  ];

  const environments = [
    { id: 'tertiary', label: 'Tertiary Care', icon: <Building2 className="w-4 h-4" />, desc: 'Full resources, Level 1 Trauma.' },
    { id: 'rural', label: 'Rural Clinic', icon: <Crosshair className="w-4 h-4" />, desc: 'Limited labs/imaging, slow results.' },
    { id: 'prehospital', label: 'EMS Environment', icon: <Truck className="w-4 h-4" />, desc: 'Field setting, monitor only.' },
    { id: 'outpatient', label: 'Outpatient Clinic', icon: <Building2 className="w-4 h-4" />, desc: 'Office visit. Labs take hours/days.' },
    { id: 'urgent_care', label: 'Urgent Care', icon: <Crosshair className="w-4 h-4" />, desc: 'Walk-in, basic labs, no CT/MRI.' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-clinical-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
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
            <div className="bg-clinical-surface border-b border-clinical-line p-4 md:p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-clinical-ink">Clinical Case Library</h2>
                <p className="text-xs text-clinical-slate uppercase tracking-widest font-medium mt-1">Select simulation parameters for real-time generation</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close case library"
                className="p-2 hover:bg-clinical-bg rounded-lg transition-colors text-clinical-slate"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-4">
                <div className="p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-clinical-line bg-clinical-bg/30 space-y-6 md:space-y-8">
                  <div>
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-4 border-b border-clinical-line pb-1">Difficulty Level</h3>
                    <div className="space-y-2">
                      {difficulties.map(d => (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDifficulty(d.id)}
                          aria-pressed={selectedDifficulty === d.id}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            selectedDifficulty === d.id
                              ? "bg-clinical-blue text-white border-clinical-blue shadow-md"
                              : "bg-clinical-surface border-clinical-line hover:border-clinical-blue/40 text-clinical-ink"
                          )}
                        >
                          <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5">{d.label}</div>
                          <div className={cn("text-[9px] leading-tight opacity-70", selectedDifficulty === d.id ? "text-white/80" : "text-clinical-slate")}>{d.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-4 border-b border-clinical-line pb-1">Care Environment</h3>
                    <div className="space-y-2">
                      {environments.map(e => (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEnv(e.id)}
                          aria-pressed={selectedEnv === e.id}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1",
                            selectedEnv === e.id
                              ? "bg-clinical-ink text-white border-clinical-ink shadow-md"
                              : "bg-clinical-surface border-clinical-line hover:border-clinical-ink/40 text-clinical-ink"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {e.icon}
                            <div className="font-bold text-[10px] uppercase tracking-wider">{e.label}</div>
                          </div>
                          <div className={cn("text-[9px] leading-tight opacity-70", selectedEnv === e.id ? "text-white/80" : "text-clinical-slate")}>{e.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest border-b border-clinical-line pb-1 flex-1">Choose Specialty Pathway</h3>
                  </div>
                  {/* Search bar */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter specialties…"
                      className="w-full pl-9 pr-8 py-2 bg-clinical-bg border border-clinical-line rounded-lg text-xs focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 transition-all"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-clinical-slate/50 hover:text-clinical-slate transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                    {categories
                      .filter(c => !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(c => (
                      <button
                        key={c.id}
                        onClick={() => onSelectCase(selectedDifficulty, c.id, selectedEnv)}
                        aria-label={`Generate ${c.label} case`}
                        className="group p-4 md:p-5 rounded-xl border border-clinical-line hover:border-clinical-blue hover:shadow-xl hover:-translate-y-1 transition-all text-left bg-clinical-surface relative overflow-hidden"
                      >
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity scale-[4]" aria-hidden="true">
                          {c.icon}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-clinical-bg border border-clinical-line flex items-center justify-center text-clinical-blue mb-3 group-hover:bg-clinical-blue group-hover:text-white transition-colors">
                          {c.icon}
                        </div>
                        <div className="font-bold text-xs text-clinical-ink group-hover:text-clinical-blue transition-colors">{c.label}</div>
                        <p className="text-[9px] text-clinical-slate mt-1 uppercase tracking-tighter opacity-60">Generate Scenario</p>
                      </button>
                    ))}

                    {searchQuery && categories.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <div className="sm:col-span-2 xl:col-span-3 py-8 text-center text-xs text-clinical-slate/50">
                        No specialties match "{searchQuery}"
                      </div>
                    )}

                    <button
                      onClick={() => onSelectCase(selectedDifficulty, 'any', selectedEnv)}
                      aria-label="Generate random case from any specialty"
                      className="sm:col-span-2 xl:col-span-3 p-4 md:p-5 rounded-xl border-2 border-dashed border-clinical-blue/30 hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all text-center group"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5 text-clinical-blue group-hover:rotate-180 transition-transform duration-700" />
                        <div className="text-left">
                          <div className="font-bold text-clinical-blue uppercase tracking-widest text-xs">Agnostic Emergency Intake</div>
                          <p className="text-[9px] text-clinical-slate uppercase tracking-tighter opacity-60 italic">Pull from entire specialized pool</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-clinical-bg p-3 md:p-4 border-t border-clinical-line shrink-0">
              <h3 className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest mb-3 border-b border-clinical-line pb-1">Recent Clinical Performance</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {loadingRecent ? (
                  <div className="flex items-center gap-2 text-[10px] text-clinical-slate uppercase py-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching history...
                  </div>
                ) : recentCases.length > 0 ? (
                  recentCases.map((rc, i) => (
                    <div key={i} className="min-w-[200px] bg-clinical-surface border border-clinical-line rounded p-3 shadow-sm hover:border-clinical-blue transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-clinical-ink">{rc.category?.toUpperCase() || 'GENERAL'}</span>
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded",
                          rc.score >= 80 ? "bg-clinical-green/10 text-clinical-green" : "bg-clinical-amber/10 text-clinical-amber"
                        )}>{rc.score}%</span>
                      </div>
                      <div className="text-xs font-bold text-clinical-slate leading-tight truncate">{rc.patient_name}</div>
                      <div className="text-[9px] text-clinical-slate opacity-60 mt-1 uppercase">DX: {rc.correct_diagnosis}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-clinical-slate uppercase opacity-40 py-2">No recent clinical history found.</div>
                )}
              </div>
            </div>

            <div className="bg-clinical-bg p-3 border-t border-clinical-line flex items-center justify-center gap-3 shrink-0">
              <div className="w-1.5 h-1.5 bg-clinical-blue rounded-full animate-pulse" aria-hidden="true" />
              <p className="text-[9px] text-clinical-slate uppercase font-bold tracking-widest">Generative engine creates unique, non-repeating patient profiles on every pick.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
