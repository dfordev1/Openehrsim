import { useState } from 'react';
import { motion } from 'motion/react';

interface GuidelineStep {
  text: string;
  critical?: boolean;
}

interface Guideline {
  id: string;
  title: string;
  steps: GuidelineStep[];
  pearl?: string;
}

const GUIDELINES: Guideline[] = [
  {
    id: 'acls',
    title: 'ACLS — Cardiac Arrest',
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
  {
    id: 'stemi',
    title: 'STEMI — Acute MI',
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
    g.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search protocols..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-b border-gray-200 pb-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
        />
      </div>

      {/* Protocol list */}
      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-300 italic">No protocols match &ldquo;{searchTerm}&rdquo;</p>
        )}

        {filtered.map((g) => (
          <div key={g.id}>
            <button
              onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
              className={
                selectedId === g.id
                  ? 'text-sm font-medium text-gray-900 py-1'
                  : 'text-sm text-gray-500 hover:text-gray-900 transition-colors py-1'
              }
            >
              {g.title}
            </button>

            {/* Expanded inline content */}
            {selectedId === g.id && (
              <div className="pl-4 mt-2 mb-4 flex flex-col gap-1">
                {g.steps.map((step, i) => (
                  <p
                    key={i}
                    className={
                      step.critical
                        ? 'text-sm text-gray-900 font-medium'
                        : 'text-sm text-gray-700'
                    }
                  >
                    {i + 1}. {step.text}
                  </p>
                ))}
                {g.pearl && (
                  <p className="text-sm text-gray-500 italic mt-2">
                    {g.pearl}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
