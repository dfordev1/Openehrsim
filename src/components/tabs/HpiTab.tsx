import React from 'react';
import { motion } from 'motion/react';
import { MedicalCase } from '../../types';

interface HpiTabProps {
  medicalCase: MedicalCase;
}

export function HpiTab({ medicalCase }: HpiTabProps) {
  return (
    <motion.div key="hpi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel">
      <div className="panel-header">
        <span className="panel-title">Intake Documentation</span>
        <span className="text-[10px] text-clinical-slate/50">{medicalCase.currentLocation}</span>
      </div>
      <div className="p-5 space-y-6">
        <section>
          <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-1.5">
            Chief Complaint
          </label>
          <p className="text-lg font-medium text-clinical-ink leading-snug">
            "{medicalCase.chiefComplaint}"
          </p>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-2 border-b border-clinical-line/50 pb-1">
              Clinical History (HPI)
            </label>
            <p className="text-sm text-clinical-ink leading-relaxed whitespace-pre-wrap">
              {medicalCase.historyOfPresentIllness}
            </p>
          </section>
          <section>
            <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-2 border-b border-clinical-line/50 pb-1">
              Past Medical History
            </label>
            <div className="space-y-1.5">
              {(medicalCase.pastMedicalHistory || []).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-clinical-ink">
                  <div className="w-1 h-1 bg-clinical-slate/30 rounded-full shrink-0" />
                  {m}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
