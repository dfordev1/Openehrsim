import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { MedicalCase } from '../../types';

interface PharmacyTabProps {
  customMedInput: string;
  onCustomMedChange: (val: string) => void;
  onAdminister: (med: string) => void;
  intervening: boolean;
  medicalCase?: MedicalCase;
}

// ── Drug interaction pairs ───────────────────────────────────────────────────
type InteractionTuple = [string, string, 'high' | 'moderate', string];
const INTERACTIONS: InteractionTuple[] = [
  ['nitroglycerin', 'heparin',      'moderate', 'NTG may reduce heparin anticoagulant effect — monitor PTT closely.'],
  ['nitroglycerin', 'epinephrine',  'moderate', 'Opposing vasoactive effects — NTG vasodilates, Epi vasoconstricts. Monitor BP carefully.'],
  ['amiodarone',    'heparin',      'moderate', 'Amiodarone may potentiate anticoagulant effect of heparin — bleeding risk ↑.'],
  ['amiodarone',    'propofol',     'high',     'Both prolong QT and cause hypotension — high risk of arrhythmia and cardiovascular collapse.'],
  ['propofol',      'fentanyl',     'high',     'Synergistic CNS/respiratory depression — titrate carefully, have reversal agents ready.'],
  ['morphine',      'propofol',     'high',     'Synergistic respiratory depression — monitor airway closely.'],
  ['morphine',      'fentanyl',     'high',     'Additive opioid effects — risk of respiratory arrest.'],
  ['atropine',      'epinephrine',  'moderate', 'Both increase HR — monitor for tachyarrhythmia.'],
  ['amiodarone',    'atropine',     'moderate', 'Atropine increases HR; amiodarone slows conduction — conflicting effects on arrhythmia.'],
  ['heparin',       'aspirin',      'high',     'Dual anticoagulant/antiplatelet therapy — major bleeding risk. Indicated in ACS but requires monitoring.'],
];

function checkInteractions(meds: string[]): Array<{ severity: 'high' | 'moderate'; message: string; drugs: string }> {
  const alerts: Array<{ severity: 'high' | 'moderate'; message: string; drugs: string }> = [];
  const lower = meds.map(m => m.toLowerCase());
  for (const [a, b, sev, msg] of INTERACTIONS) {
    const hasA = lower.some(m => m.includes(a));
    const hasB = lower.some(m => m.includes(b));
    if (hasA && hasB) {
      alerts.push({ severity: sev, message: msg, drugs: `${a} + ${b}` });
    }
  }
  return alerts;
}

interface QuickMed {
  label: string;
  hint: string;
}

const QUICK_MEDS: QuickMed[] = [
  { label: 'Epinephrine 1mg', hint: 'α1/β1/β2 agonist — first-line cardiac arrest & anaphylaxis' },
  { label: 'Amiodarone 300mg', hint: 'Class III antiarrhythmic — VF/pVT after 3rd shock' },
  { label: 'Atropine 1mg', hint: 'Vagolytic — symptomatic bradycardia' },
  { label: 'NS 1L Bolus', hint: 'Isotonic crystalloid — volume resuscitation' },
  { label: 'LR 500mL', hint: 'Balanced crystalloid — sepsis, trauma' },
  { label: 'Fentanyl 50mcg', hint: 'μ-opioid agonist — acute pain, procedural sedation' },
  { label: 'Propofol 20mg', hint: 'GABA-A sedative — RSI induction, ICU sedation' },
  { label: 'Morphine 4mg', hint: 'Opioid analgesic — moderate-severe pain' },
  { label: 'Nitroglycerin 0.4mg SL', hint: 'Nitrate vasodilator — angina, ACS chest pain' },
  { label: 'Aspirin 324mg PO', hint: 'COX inhibitor antiplatelet — give immediately in ACS' },
  { label: 'Heparin 5000u Bolus', hint: 'Antithrombin III potentiator — ACS, DVT/PE' },
  { label: 'Albumin 25%', hint: 'Colloid — SBP in cirrhosis, hepatorenal syndrome' },
];

export function PharmacyTab({ customMedInput, onCustomMedChange, onAdminister, intervening, medicalCase }: PharmacyTabProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  const administeredMeds = (medicalCase?.medications || []).map(m => m.name);
  const interactions = checkInteractions(administeredMeds);

  // Real-time pre-administration warning
  const pendingWarnings = customMedInput.trim().length > 2
    ? checkInteractions([...administeredMeds, customMedInput])
    : [];

  return (
    <motion.div
      key="pharmacy"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Hero input */}
      <div>
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
          placeholder="Administer medication..."
          className="w-full text-lg bg-transparent border-b border-clinical-line pb-2 text-clinical-ink placeholder:text-clinical-slate/50 focus:outline-none focus:border-clinical-teal transition-colors"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-clinical-slate">Press Enter to administer</span>
          {intervening && <Loader2 className="w-3 h-3 animate-spin text-clinical-slate" />}
        </div>
        {pendingWarnings.map((w, i) => (
          <div key={i} className={`mt-2 px-3 py-2 rounded-lg text-xs leading-relaxed ${w.severity === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            {w.severity === 'high' ? '⚠ HIGH: ' : '△ '}<span className="font-medium">{w.drugs}</span> — {w.message}
          </div>
        ))}
      </div>

      {/* Quick meds */}
      <div>
        <p className="text-xs text-clinical-slate mb-3">Quick medications</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {QUICK_MEDS.map((med) => (
            <span key={med.label} className="inline-flex items-center gap-1">
              <button
                onClick={() => onAdminister(med.label)}
                disabled={intervening}
                className="text-sm text-clinical-ink hover:text-clinical-ink-muted transition-colors disabled:opacity-40"
              >
                {med.label}
              </button>
              <button
                onClick={() => setTooltip(tooltip === med.label ? null : med.label)}
                className="text-xs text-clinical-slate/50 hover:text-clinical-slate transition-colors"
              >
                ?
              </button>
            </span>
          ))}
        </div>

        {/* Drug info tooltip */}
        {tooltip && (
          <p className="text-xs text-clinical-slate mt-3 italic">
            {QUICK_MEDS.find(m => m.label === tooltip)?.hint}
          </p>
        )}
      </div>

      {/* Administered medications */}
      {(medicalCase?.medications || []).length > 0 && (
        <div>
          <p className="text-xs text-clinical-slate mb-3">Administered</p>
          <div className="flex flex-col gap-1">
            {medicalCase!.medications.map((med) => (
              <p key={med.id} className="text-sm text-clinical-ink">
                <span className="text-clinical-slate font-mono">T+{med.timestamp}m</span>
                {' — '}
                {med.name} {med.dose} {med.route}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Drug interaction warnings */}
      {interactions.length > 0 && (
        <div>
          <p className="text-xs text-clinical-slate mb-3">Interactions detected</p>
          <div className="flex flex-col gap-2">
            {interactions.map((ix, i) => (
              <p key={i} className="text-sm text-clinical-ink">
                <span className={ix.severity === 'high' ? 'font-medium' : ''}>
                  {ix.severity === 'high' ? '⚠ ' : ''}{ix.drugs}
                </span>
                {' — '}
                <span className="text-clinical-slate">{ix.message}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
