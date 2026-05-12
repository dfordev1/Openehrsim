import React from 'react';
import { motion } from 'motion/react';
import { Plus, Pill } from 'lucide-react';

interface PharmacyTabProps {
  customMedInput: string;
  onCustomMedChange: (val: string) => void;
  onAdminister: (med: string) => void;
  intervening: boolean;
}

const STAT_MEDS = [
  { cat: 'Resuscitation', meds: ['Epinephrine 1mg', 'Amiodarone 300mg', 'Atropine 1mg'] },
  { cat: 'Fluids / Volume', meds: ['NS 1L Bolus', 'LR 500mL', 'Albumin 25%'] },
  { cat: 'Analgesia / Sedation', meds: ['Fentanyl 50mcg', 'Propofol 20mg', 'Morphine 4mg'] },
  { cat: 'Cardiovascular', meds: ['Nitroglycerin 0.4mg SL', 'Aspirin 324mg PO', 'Heparin 5000u Bolus'] },
];

export function PharmacyTab({ customMedInput, onCustomMedChange, onAdminister, intervening }: PharmacyTabProps) {
  return (
    <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* Stat catalog */}
        <div className="panel flex flex-col">
          <div className="panel-header">
            <span className="panel-title">Stat Medication Catalog</span>
          </div>
          <div className="panel-body space-y-4 overflow-y-auto flex-1">
            {STAT_MEDS.map((group, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-[10px] font-medium text-clinical-slate/60 uppercase">{group.cat}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                  {group.meds.map((med) => (
                    <button
                      key={med}
                      onClick={() => onAdminister(med)}
                      disabled={intervening}
                      className="flex justify-between items-center p-2.5 bg-clinical-bg/50 border border-clinical-line rounded-md hover:border-clinical-blue/30 hover:bg-clinical-blue/5 transition-all text-xs disabled:opacity-50"
                    >
                      <span>{med}</span>
                      <Plus className="w-3 h-3 text-clinical-blue/60" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom order */}
        <div className="panel flex flex-col">
          <div className="panel-header">
            <span className="panel-title">Custom Order</span>
          </div>
          <div className="panel-body flex-1 flex flex-col items-center justify-center">
            <Pill className="w-8 h-8 text-clinical-slate/20 mb-3" />
            <p className="text-xs font-medium text-clinical-slate mb-3">Custom Pharmacy Order</p>
            <div className="w-full flex gap-2">
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
                placeholder="Drug name & dose..."
                className="flex-1 bg-clinical-bg border border-clinical-line rounded-md p-2 text-xs focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30"
              />
              <button
                onClick={() => {
                  if (customMedInput) {
                    onAdminister(customMedInput);
                    onCustomMedChange('');
                  }
                }}
                disabled={!customMedInput || intervening}
                className="bg-clinical-blue text-white px-3 py-2 rounded-md text-xs font-medium disabled:opacity-50"
              >
                Give
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
