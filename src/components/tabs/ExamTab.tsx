import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MedicalCase } from '../../types';

const GCS_MAPPING = {
  eyes: [
    { score: 4, label: 'Spontaneous', desc: 'Eyes open without stimulation' },
    { score: 3, label: 'To Speech', desc: 'Eyes open to name or command' },
    { score: 2, label: 'To Pain', desc: 'Eyes open to pressure stimulation' },
    { score: 1, label: 'None', desc: 'No eye opening' },
  ],
  verbal: [
    { score: 5, label: 'Oriented', desc: 'Correctly gives name, place, date' },
    { score: 4, label: 'Confused', desc: 'Not oriented but coherent' },
    { score: 3, label: 'Inappropriate', desc: 'Isolated words or phrases' },
    { score: 2, label: 'Incomprehensible', desc: 'Moans, groans, no words' },
    { score: 1, label: 'None', desc: 'No vocalization' },
  ],
  motor: [
    { score: 6, label: 'Obeys Commands', desc: 'Performs simple movements' },
    { score: 5, label: 'Localizes Pain', desc: 'Moves toward painful stimulus' },
    { score: 4, label: 'Withdraws', desc: 'Flexion withdrawal to pain' },
    { score: 3, label: 'Abnormal Flexion', desc: 'Decorticate posturing' },
    { score: 2, label: 'Extension', desc: 'Decerebrate posturing' },
    { score: 1, label: 'None', desc: 'No motor response' },
  ],
};

interface ExamTabProps {
  medicalCase: MedicalCase;
  gcsState: { eyes: number; verbal: number; motor: number };
  onGcsChange: (category: 'eyes' | 'verbal' | 'motor', score: number) => void;
  gcsExpanded: boolean;
  onToggleGcs: () => void;
}

export function ExamTab({ medicalCase, gcsState, onGcsChange, gcsExpanded, onToggleGcs }: ExamTabProps) {
  return (
    <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      {/* GCS */}
      <div className="panel">
        <button
          onClick={onToggleGcs}
          className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors"
        >
          <span className="panel-title">Glasgow Coma Scale (GCS)</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-semibold text-clinical-blue">
              E{gcsState.eyes} V{gcsState.verbal} M{gcsState.motor} ={' '}
              {gcsState.eyes + gcsState.verbal + gcsState.motor}
            </span>
            <ChevronRight
              className={cn(
                'w-4 h-4 text-clinical-slate/40 transition-transform',
                gcsExpanded && 'rotate-90'
              )}
            />
          </div>
        </button>
        {gcsExpanded && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['eyes', 'verbal', 'motor'] as const).map((category) => (
              <div key={category} className="space-y-2" role="radiogroup" aria-label={`${category} response`}>
                <label className="text-[10px] font-medium text-clinical-slate uppercase tracking-wide">
                  {category} Response
                </label>
                <div className="flex flex-col gap-1">
                  {GCS_MAPPING[category].map((option) => (
                    <button
                      key={option.score}
                      onClick={() => onGcsChange(category, option.score)}
                      role="radio"
                      aria-checked={gcsState[category] === option.score}
                      className={cn(
                        'text-left p-2.5 rounded-md text-xs transition-all border',
                        gcsState[category] === option.score
                          ? 'bg-clinical-blue/10 text-clinical-blue border-clinical-blue/30 font-medium'
                          : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue/20 text-clinical-ink'
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span>{option.label}</span>
                        <span className="text-[10px] font-mono text-clinical-slate/50">{option.score}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Physical Exam */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Physical Examination</span>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {Object.entries(medicalCase.physicalExam || {}).map(([key, val]) => (
            <div key={key} className="space-y-1">
              <h4 className="text-[10px] font-medium text-clinical-slate uppercase">{key}</h4>
              <div className="p-2.5 bg-clinical-bg/50 border-l-2 border-clinical-line text-sm text-clinical-ink">
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
