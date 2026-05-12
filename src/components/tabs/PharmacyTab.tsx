import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pill, BookOpen, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PharmacyTabProps {
  customMedInput: string;
  onCustomMedChange: (val: string) => void;
  onAdminister: (med: string) => void;
  intervening: boolean;
}

interface DrugInfo {
  name: string;
  dose: string;
  route: string;
  class: string;
  mechanism: string;
  indications: string[];
  warnings: string[];
  color: string;
}

const DRUG_DB: Record<string, DrugInfo> = {
  'Epinephrine 1mg': {
    name: 'Epinephrine', dose: '1 mg IV/IO', route: 'IV push', class: 'Catecholamine / Vasopressor',
    mechanism: 'α1/β1/β2 agonist — increases HR, BP, bronchodilation; first-line for cardiac arrest & anaphylaxis.',
    indications: ['Cardiac arrest (PEA/VF/asystole)', 'Anaphylaxis', 'Severe bronchospasm'],
    warnings: ['Risk of hypertensive crisis', 'Extravasation causes tissue necrosis — use central line if possible'],
    color: 'text-clinical-red',
  },
  'Amiodarone 300mg': {
    name: 'Amiodarone', dose: '300 mg IV', route: 'IV push (arrest); infusion (stable)',
    class: 'Class III Antiarrhythmic',
    mechanism: 'Blocks K⁺, Na⁺, Ca²⁺ channels + β-blockade. Slows conduction, prolongs QT.',
    indications: ['VF/pulseless VT (arrest)', 'Stable VT', 'AF with RVR (rate control)'],
    warnings: ['Prolongs QT — risk torsades', 'Pulmonary/hepatic/thyroid toxicity with chronic use', 'Hypotension with rapid IV infusion'],
    color: 'text-clinical-amber',
  },
  'Atropine 1mg': {
    name: 'Atropine', dose: '1 mg IV', route: 'IV push',
    class: 'Anticholinergic / Vagolytic',
    mechanism: 'Blocks muscarinic receptors — increases HR by reducing vagal tone.',
    indications: ['Symptomatic bradycardia', 'Organophosphate poisoning'],
    warnings: ['May worsen ischemia by increasing HR', 'Not effective in type II 2° or 3° AV block — use pacing'],
    color: 'text-clinical-blue',
  },
  'NS 1L Bolus': {
    name: 'Normal Saline', dose: '1000 mL', route: 'IV infusion (30 min)',
    class: 'Isotonic Crystalloid',
    mechanism: 'Expands intravascular volume. Na 154 mEq/L, Cl 154 mEq/L.',
    indications: ['Hypovolemic shock', 'Sepsis resuscitation', 'Dehydration'],
    warnings: ['Hyperchloremic metabolic acidosis with large volumes', 'Fluid overload in CHF/renal failure'],
    color: 'text-clinical-blue',
  },
  'LR 500mL': {
    name: 'Lactated Ringer\'s', dose: '500 mL', route: 'IV infusion',
    class: 'Balanced Isotonic Crystalloid',
    mechanism: 'More physiologic than NS — Na 130, K 4, Ca 3, Cl 109, Lactate 28 mEq/L.',
    indications: ['Sepsis (preferred over NS)', 'Trauma resuscitation', 'Burns'],
    warnings: ['Avoid in hyperkalemia', 'Lactate metabolized to bicarb — not for lactic acidosis monitoring'],
    color: 'text-clinical-blue',
  },
  'Albumin 25%': {
    name: 'Albumin 25%', dose: '100 mL (25 g)', route: 'IV infusion',
    class: 'Colloid / Oncotic agent',
    mechanism: 'Increases intravascular oncotic pressure — draws fluid from interstitium.',
    indications: ['SBP treatment in cirrhosis + large-volume paracentesis', 'Hepatorenal syndrome'],
    warnings: ['Expensive', 'No mortality benefit over crystalloids in most patients', 'Avoid in cardiac failure'],
    color: 'text-clinical-amber',
  },
  'Fentanyl 50mcg': {
    name: 'Fentanyl', dose: '25–100 mcg IV', route: 'IV push (slow)',
    class: 'Opioid Analgesic / Sedation',
    mechanism: 'μ-opioid receptor agonist. Rapid onset (1 min), short duration (30–60 min).',
    indications: ['Acute pain', 'Procedural sedation', 'Intubation premedication'],
    warnings: ['Respiratory depression — have naloxone ready', 'Chest wall rigidity at high doses', 'Avoid in hypotension'],
    color: 'text-clinical-slate',
  },
  'Propofol 20mg': {
    name: 'Propofol', dose: '1–2 mg/kg IV', route: 'IV push (induction) or infusion (sedation)',
    class: 'GABA-A Sedative-Hypnotic',
    mechanism: 'Enhances GABA-A inhibition. Rapid onset/offset. Anticonvulsant properties.',
    indications: ['Rapid sequence intubation (induction)', 'ICU sedation', 'Status epilepticus (refractory)'],
    warnings: ['Causes hypotension and apnea — airway must be controlled', 'Propofol infusion syndrome with prolonged high-dose use (metabolic acidosis, rhabdo)', 'Contains egg/soy — allergy caution'],
    color: 'text-clinical-slate',
  },
  'Morphine 4mg': {
    name: 'Morphine', dose: '2–4 mg IV q4h', route: 'IV push (slow)',
    class: 'Opioid Analgesic',
    mechanism: 'μ-opioid agonist. Longer duration than fentanyl (3–4 h). Histamine release.',
    indications: ['Moderate-severe pain', 'Acute MI pain (use with caution)'],
    warnings: ['Respiratory depression', 'Histamine release → hypotension/bronchospasm', 'Use caution in renal failure (active metabolites accumulate)'],
    color: 'text-clinical-slate',
  },
  'Nitroglycerin 0.4mg SL': {
    name: 'Nitroglycerin', dose: '0.4 mg SL q5min × 3', route: 'Sublingual',
    class: 'Nitrate / Vasodilator',
    mechanism: 'Releases NO → venodilation (preload ↓) and coronary vasodilation.',
    indications: ['Angina / STEMI chest pain', 'Hypertensive emergency with ACS', 'Acute pulmonary edema'],
    warnings: ['CONTRAINDICATED with PDE5 inhibitors (sildenafil — severe hypotension)', 'Avoid if SBP < 90 or RV infarct', 'Tolerance with continuous use'],
    color: 'text-clinical-green',
  },
  'Aspirin 324mg PO': {
    name: 'Aspirin', dose: '324 mg PO (chewed)', route: 'Oral',
    class: 'Antiplatelet / NSAID',
    mechanism: 'Irreversibly inhibits COX-1/2 → ↓ TXA2 → antiplatelet effect.',
    indications: ['ACS / STEMI — GIVE IMMEDIATELY', 'Stroke prevention', 'Pericarditis'],
    warnings: ['GI bleeding', 'Reye syndrome in children', 'Allergy — use clopidogrel if ASA-allergic'],
    color: 'text-clinical-green',
  },
  'Heparin 5000u Bolus': {
    name: 'Unfractionated Heparin', dose: '60–80 u/kg IV bolus (max 5000u), then 12–18 u/kg/h infusion',
    route: 'IV', class: 'Anticoagulant',
    mechanism: 'Potentiates antithrombin III → inhibits thrombin (IIa) and Factor Xa.',
    indications: ['STEMI / ACS (bridging to PCI)', 'DVT/PE treatment', 'AFib with stroke risk'],
    warnings: ['HIT (Heparin-Induced Thrombocytopenia) — check platelets', 'Bleeding risk — reverse with Protamine', 'Monitor PTT 1.5–2× normal'],
    color: 'text-clinical-amber',
  },
};

const STAT_MEDS = [
  { cat: 'Resuscitation',         meds: ['Epinephrine 1mg', 'Amiodarone 300mg', 'Atropine 1mg'] },
  { cat: 'Fluids / Volume',       meds: ['NS 1L Bolus', 'LR 500mL', 'Albumin 25%'] },
  { cat: 'Analgesia / Sedation',  meds: ['Fentanyl 50mcg', 'Propofol 20mg', 'Morphine 4mg'] },
  { cat: 'Cardiovascular',        meds: ['Nitroglycerin 0.4mg SL', 'Aspirin 324mg PO', 'Heparin 5000u Bolus'] },
];

export function PharmacyTab({ customMedInput, onCustomMedChange, onAdminister, intervening }: PharmacyTabProps) {
  const [selectedDrug, setSelectedDrug] = useState<DrugInfo | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  return (
    <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">

        {/* ── Stat catalog ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 panel flex flex-col">
          <div className="panel-header">
            <span className="panel-title">Stat Medication Catalog</span>
            <button
              onClick={() => setRefOpen(p => !p)}
              className="flex items-center gap-1 text-[10px] text-clinical-blue font-medium hover:underline"
            >
              <BookOpen className="w-3 h-3" />
              {refOpen ? 'Hide' : 'Drug Ref'}
            </button>
          </div>
          <div className="panel-body space-y-4 overflow-y-auto flex-1">
            {STAT_MEDS.map((group, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-[10px] font-medium text-clinical-slate/60 uppercase">{group.cat}</label>
                <div className="flex flex-col gap-1.5">
                  {group.meds.map((med) => {
                    const info = DRUG_DB[med];
                    return (
                      <div key={med} className="flex gap-1">
                        <button
                          onClick={() => onAdminister(med)}
                          disabled={intervening}
                          className="flex-1 flex justify-between items-center p-2.5 bg-clinical-bg/50 border border-clinical-line rounded-md hover:border-clinical-blue/30 hover:bg-clinical-blue/5 transition-all text-xs disabled:opacity-50"
                        >
                          <span>{med}</span>
                          <Plus className="w-3 h-3 text-clinical-blue/60 shrink-0" />
                        </button>
                        {info && (
                          <button
                            onClick={() => { setSelectedDrug(info); setRefOpen(true); }}
                            className="px-2 border border-clinical-line rounded-md text-clinical-slate/50 hover:text-clinical-blue hover:border-clinical-blue/30 transition-all"
                            title={`View ${info.name} drug reference`}
                          >
                            <BookOpen className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Custom order + Drug reference ─────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Custom order */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Custom Pharmacy Order</span>
            </div>
            <div className="panel-body flex items-center gap-3">
              <Pill className="w-6 h-6 text-clinical-slate/20 shrink-0" />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={customMedInput}
                  onChange={(e) => onCustomMedChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customMedInput) {
                      onAdminister(customMedInput);
                      onCustomMedChange('');
                    }
                  }}
                  placeholder="e.g. Vancomycin 25mg/kg IV, Metoprolol 5mg IV..."
                  className="flex-1 bg-clinical-bg border border-clinical-line rounded-md p-2.5 text-xs focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30"
                />
                <button
                  onClick={() => {
                    if (customMedInput) { onAdminister(customMedInput); onCustomMedChange(''); }
                  }}
                  disabled={!customMedInput || intervening}
                  className="bg-clinical-blue text-white px-4 py-2.5 rounded-md text-xs font-medium disabled:opacity-50 hover:bg-clinical-blue/90 transition-colors"
                >
                  Give
                </button>
              </div>
            </div>
          </div>

          {/* Drug reference card */}
          <AnimatePresence>
            {refOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="panel flex-1"
              >
                <div className="panel-header">
                  <span className="panel-title flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-clinical-blue" />
                    Drug Reference
                  </span>
                  <button onClick={() => setRefOpen(false)} className="p-1 rounded hover:bg-clinical-bg transition-colors">
                    <X className="w-3.5 h-3.5 text-clinical-slate/50" />
                  </button>
                </div>
                <div className="p-4">
                  {selectedDrug ? (
                    <div className="space-y-4 animate-in fade-in">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={cn('text-base font-bold', selectedDrug.color)}>{selectedDrug.name}</h3>
                          <p className="text-[10px] text-clinical-slate uppercase tracking-wide">{selectedDrug.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-clinical-ink">{selectedDrug.dose}</p>
                          <p className="text-[10px] text-clinical-slate">{selectedDrug.route}</p>
                        </div>
                      </div>

                      {/* Mechanism */}
                      <div className="bg-clinical-bg/60 border border-clinical-line rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-clinical-slate uppercase mb-1">Mechanism</p>
                        <p className="text-xs text-clinical-ink leading-relaxed">{selectedDrug.mechanism}</p>
                      </div>

                      {/* Indications */}
                      <div>
                        <p className="text-[10px] font-semibold text-clinical-green uppercase mb-1.5">Indications</p>
                        <ul className="space-y-1">
                          {selectedDrug.indications.map((ind, i) => (
                            <li key={i} className="text-xs text-clinical-ink flex items-start gap-2">
                              <span className="text-clinical-green mt-0.5">✓</span>{ind}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Warnings */}
                      <div className="bg-clinical-red/5 border border-clinical-red/20 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-clinical-red uppercase mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />Warnings
                        </p>
                        <ul className="space-y-1">
                          {selectedDrug.warnings.map((w, i) => (
                            <li key={i} className="text-xs text-clinical-red/80 flex items-start gap-2">
                              <span className="shrink-0 mt-0.5">⚠</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                      <BookOpen className="w-8 h-8 text-clinical-slate/20" />
                      <p className="text-xs text-clinical-slate">Click the <BookOpen className="w-3 h-3 inline" /> icon next to any drug to view its reference card</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </motion.div>
  );
}
