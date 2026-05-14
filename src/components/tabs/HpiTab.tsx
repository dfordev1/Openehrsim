import { motion } from 'motion/react';
import type { MedicalCase } from '../../types';

interface HpiTabProps {
  medicalCase: MedicalCase;
}

export function HpiTab({ medicalCase }: HpiTabProps) {
  const pmh = medicalCase.pastMedicalHistory || [];

  return (
    <motion.div
      key="hpi"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-10 py-8"
    >
      {/* Hero: History of present illness */}
      <p className="text-base text-clinical-ink leading-relaxed whitespace-pre-wrap">
        {medicalCase.historyOfPresentIllness}
      </p>

      {/* Past medical history */}
      {pmh.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-clinical-slate">Past Medical History</p>
          <ul className="space-y-1">
            {pmh.map((item, i) => (
              <li key={i} className="text-sm text-clinical-ink">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
