import React, { useState } from 'react';
import {
  BookOpen, Search, ChevronRight, CheckCircle2, ShieldAlert, Zap,
  Thermometer, Heart, Wind, Activity, Syringe, Brain, Droplets,
  AlertTriangle, FlaskConical,
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { cn } from '../lib/utils';

interface GuidelineStep {
  text: string;
  critical?: boolean;  // highlight as time-critical
}

interface Guideline {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  colour: string;       // accent colour class
  steps: GuidelineStep[];
  pearl?: string;       // clinical pearl at the bottom
}

const GUIDELINES: Guideline[] = [
  // ── Existing ─────────────────────────────────────────────────────────────
  {
    id: 'acls',
    title: 'ACLS — Cardiac Arrest',
    category: 'Cardiology',
    icon: <Zap className="w-4 h-4" />,
    colour: 'text-clinical-amber',
    steps: [
      { text: 'Start high-quality CPR: 100–120/min, 5–6 cm depth, allow full recoil.', critical: true },
      { text: 'Give oxygen; attach monitor/defibrillator within 10 seconds.' },
      { text: 'Identify rhythm: Shockable (VF/pVT) → defibrillate immediately.' },
      { text: 'Non-shockable (Asystole/PEA) → continue CPR, find & treat cause (Hs & Ts).' },
      { text: 'Epinephrine 1 mg IV/IO every 3–5 min (non-shockable: give ASAP).', critical: true },
      { text: 'Amiodarone 300 mg IV for VF/pVT after 3rd shock (then 150 mg).' },
      { text: 'Consider advanced airway (ETT/LMA); confirm with waveform capnography.' },
      { text: 'PETCO₂ < 10 mmHg after 20 min → consider termination of efforts.' },
    ],
    pearl: 'High-quality CPR is the single strongest determinant of ROSC. Minimize interruptions.',
  },
  {
    id: 'sepsis',
    title: 'Sepsis — 1-Hour Bundle',
    category: 'Critical Care',
    icon: <Thermometer className="w-4 h-4" />,
    colour: 'text-clinical-blue',
    steps: [
      { text: 'Draw blood cultures ×2 (before antibiotics).' },
      { text: 'Measure serum Lactate (repeat at 2 h if ≥ 2 mmol/L).', critical: true },
      { text: 'Give broad-spectrum IV antibiotics within 1 hour of recognition.', critical: true },
      { text: 'Administer 30 mL/kg IV crystalloid for hypotension or Lactate ≥ 4 mmol/L.' },
      { text: 'Apply vasopressors (Norepinephrine first-line) if MAP < 65 mmHg persists.' },
      { text: 'Target MAP ≥ 65 mmHg, UO ≥ 0.5 mL/kg/h.' },
      { text: 'Reassess fluid responsiveness after initial bolus (avoid fluid overload).' },
    ],
    pearl: 'Every hour of antibiotic delay increases mortality by ~7%. Start empiric therapy immediately.',
  },
  {
    id: 'stroke',
    title: 'Acute Ischaemic Stroke',
    category: 'Neurology',
    icon: <ShieldAlert className="w-4 h-4" />,
    colour: 'text-clinical-red',
    steps: [
      { text: 'Document Last Known Well (LKW) time precisely.', critical: true },
      { text: 'Stat Non-Contrast CT Head to exclude haemorrhage.' },
      { text: 'Check blood glucose (treat if < 2.8 mmol/L).' },
      { text: 'IV alteplase 0.9 mg/kg (max 90 mg) within 4.5 h of LKW if eligible.', critical: true },
      { text: 'Mechanical thrombectomy for large-vessel occlusion ≤ 24 h (CTA required).' },
      { text: 'Maintain BP < 185/110 if giving tPA; permissive hypertension otherwise.' },
      { text: 'Consult Neurology/Stroke team and consider ICU admission.' },
    ],
    pearl: '"Time is brain" — 1.9 million neurons lost every minute without reperfusion.',
  },

  // ── New ───────────────────────────────────────────────────────────────────
  {
    id: 'stemi',
    title: 'STEMI — Acute MI',
    category: 'Cardiology',
    icon: <Heart className="w-4 h-4" />,
    colour: 'text-clinical-red',
    steps: [
      { text: '12-lead ECG within 10 minutes; confirm ≥ 2 mm ST elevation in ≥ 2 contiguous leads.', critical: true },
      { text: 'Aspirin 324 mg PO (chewed) + Ticagrelor 180 mg or Clopidogrel 600 mg immediately.', critical: true },
      { text: 'Heparin 60–70 U/kg bolus (max 5000 U) IV.' },
      { text: 'Activate cardiac catheterisation lab: target door-to-balloon ≤ 90 min.', critical: true },
      { text: 'Nitroglycerin SL × 3 for ongoing chest pain (hold if SBP < 90 or RV infarct).' },
      { text: 'Morphine/Fentanyl for refractory pain; supplemental O₂ if SpO₂ < 94%.' },
      { text: 'Avoid NSAIDs. Obtain echo post-PCI to assess LV function.' },
    ],
    pearl: 'Inferior MI (II, III, aVF elevation) — always obtain right-sided leads; RV infarct contraindicates nitrates.',
  },
  {
    id: 'pe',
    title: 'Pulmonary Embolism',
    category: 'Pulmonology',
    icon: <Wind className="w-4 h-4" />,
    colour: 'text-clinical-blue',
    steps: [
      { text: 'Risk-stratify: Wells Score / PERC Rule to guide imaging.' },
      { text: 'CT Pulmonary Angiography (CTPA) — gold standard; V/Q scan if contrast allergy/renal impairment.' },
      { text: 'High-risk (haemodynamic instability): systemic thrombolysis alteplase 100 mg IV over 2 h.', critical: true },
      { text: 'Intermediate/Low-risk: anticoagulate immediately (LMWH, UFH, or DOAC).' },
      { text: 'UFH preferred if thrombolysis possible or severe renal impairment.' },
      { text: 'Monitor RV function with echo; consider embolectomy if thrombolysis fails.' },
      { text: 'Supplemental O₂; cautious fluids (excess RV preload worsens RV failure).' },
    ],
    pearl: 'Massive PE with PEA arrest: empiric thrombolysis has high survival benefit. Continue CPR 60–90 min post-dose.',
  },
  {
    id: 'dka',
    title: 'Diabetic Ketoacidosis',
    category: 'Endocrinology',
    icon: <FlaskConical className="w-4 h-4" />,
    colour: 'text-clinical-amber',
    steps: [
      { text: 'Confirm diagnosis: BGL > 14, pH < 7.3, bicarb < 15, ketonaemia/uria.' },
      { text: 'IV access × 2; send: BGL, VBG, U&E, BUN, FBC, cultures, ECG.' },
      { text: 'NS 1L over 1 h; reassess, then 250–500 mL/h based on haemodynamics.', critical: true },
      { text: 'Insulin infusion: 0.1 U/kg/h regular insulin (after K⁺ ≥ 3.5 mmol/L).', critical: true },
      { text: 'Replace potassium aggressively: add 20–40 mmol/L to IV fluids when K⁺ < 5.0.' },
      { text: 'Switch to D5W + insulin when BGL drops to 14 mmol/L to prevent hypoglycaemia.' },
      { text: 'Identify and treat precipitant (infection, missed insulin, new diabetes).' },
    ],
    pearl: 'Never start insulin without adequate potassium replacement — precipitates fatal hypokalaemia.',
  },
  {
    id: 'anaphylaxis',
    title: 'Anaphylaxis',
    category: 'Immunology',
    icon: <AlertTriangle className="w-4 h-4" />,
    colour: 'text-clinical-red',
    steps: [
      { text: 'Epinephrine 0.5 mg IM (anterolateral thigh) — give IMMEDIATELY.', critical: true },
      { text: 'Call for help; place supine; elevate legs (unless dyspnoea).' },
      { text: 'High-flow O₂; prepare for airway management — it can close rapidly.' },
      { text: 'Large-bore IV access; NS 1–2L rapid bolus for hypotension.' },
      { text: 'Repeat epinephrine every 5–15 min if no improvement (no maximum dose).' },
      { text: 'Antihistamine (chlorphenamine 10 mg IV) and hydrocortisone 200 mg IV — adjuncts only.' },
      { text: 'Observe ≥ 6–12 h for biphasic reaction (occurs in up to 20% of cases).' },
    ],
    pearl: 'Epinephrine is the ONLY life-saving drug in anaphylaxis. Antihistamines and steroids do NOT reverse bronchospasm or hypotension.',
  },
  {
    id: 'status_epilepticus',
    title: 'Status Epilepticus',
    category: 'Neurology',
    icon: <Brain className="w-4 h-4" />,
    colour: 'text-clinical-amber',
    steps: [
      { text: '0–5 min: Airway, Breathing, Circulation; check BGL, IV access, oxygen.' },
      { text: '5 min: Lorazepam 4 mg IV (or Diazepam 10 mg IV) — first-line benzodiazepine.', critical: true },
      { text: '10 min: Repeat benzodiazepine if seizure continues.' },
      { text: '20 min: Second-line — Levetiracetam 60 mg/kg IV, or Valproate 40 mg/kg, or Phenytoin 20 mg/kg.', critical: true },
      { text: '40 min: Refractory status → ICU, intubation, anaesthetic (Propofol/Midazolam/Thiopentone).' },
      { text: 'Continuous EEG monitoring; treat underlying cause (infection, metabolic, toxin).' },
    ],
    pearl: 'Non-convulsive SE (subtle motor activity or post-ictal confusion) requires EEG — clinically easy to miss.',
  },
  {
    id: 'hypertensive_emergency',
    title: 'Hypertensive Emergency',
    category: 'Cardiology',
    icon: <Activity className="w-4 h-4" />,
    colour: 'text-clinical-red',
    steps: [
      { text: 'Confirm end-organ damage: fundoscopy, ECG, troponin, creatinine, UA, CXR.' },
      { text: 'Reduce MAP by ≤ 25% in first hour — too fast causes ischaemia.', critical: true },
      { text: 'ICU admission; continuous arterial line monitoring.' },
      { text: 'Aortic dissection: target SBP 100–120 — labetalol + nitroprusside.' },
      { text: 'Hypertensive encephalopathy/eclampsia: labetalol or nicardipine IV.' },
      { text: 'Pulmonary oedema: GTN infusion + frusemide.' },
      { text: 'Avoid oral agents; use IV titratable agents only.' },
    ],
    pearl: 'Hypertensive urgency (no end-organ damage) does NOT require IV therapy — oral agents + 24–72 h follow-up.',
  },
  {
    id: 'trauma',
    title: 'Trauma — ATLS Primary Survey',
    category: 'Trauma',
    icon: <Droplets className="w-4 h-4" />,
    colour: 'text-clinical-slate',
    steps: [
      { text: 'A — Airway with C-spine control: chin-lift/jaw-thrust, RSI if GCS ≤ 8.', critical: true },
      { text: 'B — Breathing: bilateral breath sounds, treat pneumothorax (needle then chest drain).' },
      { text: 'C — Circulation: two large-bore IVs, apply direct pressure to bleeding, MTP for haemorrhage.', critical: true },
      { text: 'D — Disability: GCS, pupils, blood glucose.' },
      { text: 'E — Exposure: full undress; log-roll; maintain normothermia (warm blankets, warm fluids).' },
      { text: 'TXA 1 g IV within 3 h of injury if significant haemorrhage suspected.', critical: true },
      { text: 'FAST exam; CXR; pelvis XR. CT "trauma pan-scan" for haemodynamically stable patients.' },
    ],
    pearl: 'Permissive hypotension (SBP 80–90) until haemorrhage control — aggressive fluid resuscitation worsens coagulopathy.',
  },
  {
    id: 'aki',
    title: 'Acute Kidney Injury',
    category: 'Nephrology',
    icon: <Syringe className="w-4 h-4" />,
    colour: 'text-clinical-blue',
    steps: [
      { text: 'Classify by KDIGO staging: creatinine rise ≥ 26 µmol/L in 48 h, or ≥ 1.5× baseline.' },
      { text: 'Identify cause: Pre-renal (hypovolaemia), Intrinsic (ATN, GN), Post-renal (obstruction).' },
      { text: 'Bladder scan/catheter to exclude obstruction; urine Na, osmolality, microscopy.' },
      { text: 'Correct hypovolaemia: cautious fluid resuscitation (crystalloid preferred).', critical: true },
      { text: 'Treat hyperkalaemia urgently if K⁺ > 6.0 or ECG changes: Ca gluconate, insulin/dextrose, salbutamol.', critical: true },
      { text: 'Hold nephrotoxins: NSAIDs, ACEi/ARBs, contrast, aminoglycosides.' },
      { text: 'Renal replacement therapy if: refractory hyperkalaemia, acidosis, fluid overload, uraemic symptoms.' },
    ],
    pearl: 'ACE-inhibitors cause efferent arteriole dilation — beneficial in CKD but worsen pre-renal AKI. Withhold in acute setting.',
  },
];

export function ClinicalGuidelines() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = GUIDELINES.filter(g =>
    g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const categories = Array.from(new Set(filtered.map(g => g.category)));

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="panel flex flex-col flex-1 min-h-0">
        <div className="panel-header shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-clinical-blue" />
            <span className="panel-title">Clinical Protocols</span>
            <span className="text-[9px] bg-clinical-blue/10 text-clinical-blue px-1.5 py-0.5 rounded-full font-medium">
              {GUIDELINES.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/40" />
            <input
              type="text"
              placeholder="Search protocols…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-clinical-bg border border-clinical-line rounded-md h-8 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-blue/50 transition-all w-44"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-clinical-line/50">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="w-10 h-10" />}
              title="No protocols found"
              description={`No results for "${searchTerm}"`}
            />
          ) : (
            categories.map(cat => (
              <div key={cat}>
                {/* Category header */}
                <div className="px-4 py-1.5 bg-clinical-bg/50 border-b border-clinical-line/50">
                  <span className="text-[9px] font-bold text-clinical-slate/60 uppercase tracking-widest">{cat}</span>
                </div>

                {filtered.filter(g => g.category === cat).map(g => (
                  <div key={g.id}>
                    <button
                      onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-clinical-bg/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg bg-clinical-bg border border-clinical-line flex items-center justify-center',
                          g.colour
                        )}>
                          {g.icon}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-clinical-ink">{g.title}</div>
                          <div className="text-[10px] text-clinical-slate">{g.steps.length} steps</div>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        'w-4 h-4 text-clinical-slate/40 transition-transform shrink-0',
                        selectedId === g.id && 'rotate-90'
                      )} />
                    </button>

                    {selectedId === g.id && (
                      <div className="bg-clinical-bg/30 px-4 pb-4 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                          {g.steps.map((step, i) => (
                            <div key={i} className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border',
                              step.critical
                                ? 'bg-clinical-red/5 border-clinical-red/20'
                                : 'bg-clinical-surface border-clinical-line'
                            )}>
                              {step.critical
                                ? <AlertTriangle className="w-3.5 h-3.5 text-clinical-red shrink-0 mt-0.5" />
                                : <CheckCircle2 className="w-3.5 h-3.5 text-clinical-blue shrink-0 mt-0.5" />
                              }
                              <span className="text-xs text-clinical-ink leading-relaxed">{step.text}</span>
                            </div>
                          ))}

                          {/* Clinical pearl */}
                          {g.pearl && (
                            <div className="flex gap-3 mt-3 bg-clinical-blue/5 border border-clinical-blue/20 rounded-lg p-3">
                              <BookOpen className="w-3.5 h-3.5 text-clinical-blue shrink-0 mt-0.5" />
                              <p className="text-xs text-clinical-ink leading-relaxed">
                                <strong className="text-clinical-blue">Pearl: </strong>{g.pearl}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4 bg-clinical-blue/5 border border-clinical-blue/10 rounded-lg flex gap-3 shrink-0">
        <ShieldAlert className="w-4 h-4 text-clinical-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-clinical-blue mb-0.5">Evidence-Based Medicine</p>
          <p className="text-xs text-clinical-slate leading-relaxed">
            Based on current ILCOR, AHA, Surviving Sepsis Campaign, ESC, and NICE guidelines.
            <span className="text-clinical-red"> Red steps</span> are time-critical interventions.
          </p>
        </div>
      </div>
    </div>
  );
}
