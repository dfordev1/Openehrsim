import React, { useState } from 'react';
import { BookOpen, Search, ChevronRight, CheckCircle2, ShieldAlert, Zap, Thermometer } from 'lucide-react';

const GUIDELINES = [
  {
    id: 'acls',
    title: 'ACLS Cardiac Arrest',
    category: 'Cardiology',
    icon: <Zap className="w-4 h-4 text-amber-500" />,
    steps: [
      'Start CPR: Give oxygen, attach monitor/defibrillator',
      'Check Rhythm: Shockable (VF/pVT) or Non-shockable (Asystole/PEA)',
      'Epinephrine: 1mg every 3-5 mins',
      'Amiodarone: 300mg bolus (for VF/pVT)',
      'Consider Advanced Airway & Capnography'
    ]
  },
  {
    id: 'sepsis',
    title: 'Sepsis 1-Hour Bundle',
    category: 'Critical Care',
    icon: <Thermometer className="w-4 h-4 text-clinical-blue" />,
    steps: [
      'Measure Lactate level',
      'Obtain Blood Cultures before antibiotics',
      'Administer Broad-spectrum Antibiotics',
      'Begin rapid administration of 30mL/kg crystalloid for hypotension',
      'Apply Vasopressors if hypotensive during/after fluid resuscitation'
    ]
  },
  {
    id: 'stroke',
    title: 'Acute Stroke (NIHSS)',
    category: 'Neurology',
    icon: <ShieldAlert className="w-4 h-4 text-clinical-red" />,
    steps: [
      'Last Known Well time verification',
      'Stat Non-Contrast Head CT/CTA',
      'Check Blood Glucose (exclude hypoglycemia)',
      'Assess for tPA inclusion/exclusion criteria',
      'Consult Neurosurgery/Interventional Neurology'
    ]
  }
];

export function ClinicalGuidelines() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = GUIDELINES.filter(g => 
    g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col max-h-[500px]">
        <div className="bg-clinical-bg p-4 border-b border-clinical-line flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-clinical-blue" />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate" />
            <input 
              type="text"
              placeholder="Search Institutional Guidelines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-clinical-line rounded h-9 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-clinical-blue transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-clinical-line">
          {filtered.map(g => (
            <div key={g.id} className="group">
              <button 
                onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-clinical-bg/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-white border border-clinical-line flex items-center justify-center shadow-sm group-hover:border-clinical-blue transition-colors">
                    {g.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-clinical-ink">{g.title}</div>
                    <div className="text-[10px] font-bold text-clinical-slate uppercase tracking-widest">{g.category}</div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-clinical-slate transition-transform ${selectedId === g.id ? 'rotate-90' : ''}`} />
              </button>
              
              {selectedId === g.id && (
                <div className="bg-clinical-bg/30 px-4 pb-4 animate-in slide-in-from-top-2">
                  <div className="mt-2 space-y-2">
                    {g.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white border border-clinical-line rounded-lg shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-clinical-blue shrink-0 mt-0.5" />
                        <span className="text-xs font-medium text-clinical-ink leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-xs font-bold text-clinical-slate uppercase tracking-widest opacity-40">No protocols matching search query</div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl flex gap-4">
        <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
        <div>
          <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Evidence-Based Medicine</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            These protocols are based on current ILCOR, AHA, and Surviving Sepsis Campaign guidelines. Use clinical judgment for bedside deviations.
          </p>
        </div>
      </div>
    </div>
  );
}
