import React, { useState } from 'react';
import { BookOpen, Search, ChevronRight, CheckCircle2, ShieldAlert, Zap, Thermometer } from 'lucide-react';
import { EmptyState } from './EmptyState';

const GUIDELINES = [
  {
    id: 'acls',
    title: 'ACLS Cardiac Arrest',
    category: 'Cardiology',
    icon: <Zap className="w-4 h-4 text-clinical-amber" />,
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
    <div className="flex flex-col gap-4 h-full">
      <div className="panel flex flex-col max-h-[500px]">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-clinical-blue" />
            <span className="panel-title">Clinical Protocols</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-clinical-slate/40" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-clinical-bg border border-clinical-line rounded-md h-8 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-blue/50 transition-all w-44"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-clinical-line/50">
          {filtered.map(g => (
            <div key={g.id}>
              <button
                onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-clinical-bg/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-clinical-bg border border-clinical-line flex items-center justify-center">
                    {g.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-clinical-ink">{g.title}</div>
                    <div className="text-[10px] text-clinical-slate">{g.category}</div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-clinical-slate/40 transition-transform ${selectedId === g.id ? 'rotate-90' : ''}`} />
              </button>

              {selectedId === g.id && (
                <div className="bg-clinical-bg/30 px-4 pb-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    {g.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white border border-clinical-line rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-clinical-blue shrink-0 mt-0.5" />
                        <span className="text-xs text-clinical-ink leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <EmptyState
              icon={<Search className="w-10 h-10" />}
              title="No protocols found"
              description="Try a different search term."
            />
          )}
        </div>
      </div>

      <div className="p-4 bg-clinical-blue/5 border border-clinical-blue/10 rounded-lg flex gap-3">
        <ShieldAlert className="w-4 h-4 text-clinical-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-clinical-blue mb-0.5">Evidence-Based Medicine</p>
          <p className="text-xs text-clinical-slate leading-relaxed">
            Protocols based on current ILCOR, AHA, and Surviving Sepsis Campaign guidelines. Use clinical judgment for bedside deviations.
          </p>
        </div>
      </div>
    </div>
  );
}
