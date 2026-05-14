import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { MedicalCase } from '../../types';

interface TriageTabProps {
  medicalCase: MedicalCase;
}

export function TriageTab({ medicalCase }: TriageTabProps) {
  const genderAbbr = medicalCase.gender?.toLowerCase().includes('f') ? 'F' : 'M';
  const pmh = medicalCase.pastMedicalHistory || [];

  return (
    <motion.div
      key="triage"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-10 py-8"
    >
      {/* Hero: Chief complaint */}
      <p className="text-xl font-medium text-clinical-ink leading-relaxed">
        &ldquo;{medicalCase.chiefComplaint}&rdquo;
      </p>

      {/* One-line demographics */}
      <p className="text-sm text-clinical-slate">
        {medicalCase.age}{genderAbbr} &middot; {medicalCase.currentLocation}
      </p>

      {/* Initial appearance */}
      {medicalCase.initialAppearance && (
        <p className="text-sm text-clinical-slate italic leading-relaxed">
          {medicalCase.initialAppearance}
        </p>
      )}

      {/* Past medical history */}
      {pmh.length > 0 && (
        <p className="text-sm text-clinical-slate leading-relaxed">
          <span className="font-medium text-clinical-slate">PMH</span>{' '}
          {pmh.join(', ')}
        </p>
      )}
    </motion.div>
  );
}
