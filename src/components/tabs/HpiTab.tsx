import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MedicalCase } from '../../types';

interface HpiTabProps {
  medicalCase: MedicalCase;
}

function getDifficultyColor(diff?: string) {
  if (diff === 'attending') return 'bg-clinical-red/8 text-clinical-red border-clinical-red/20';
  if (diff === 'intern')    return 'bg-clinical-green/8 text-clinical-green border-clinical-green/20';
  return 'bg-clinical-amber/8 text-clinical-amber border-clinical-amber/20';
}

function getAgeGroup(age?: number): string {
  if (!age) return '';
  if (age < 18)  return 'Pediatric';
  if (age < 40)  return 'Young Adult';
  if (age < 65)  return 'Middle-aged';
  if (age < 80)  return 'Elderly';
  return 'Very Elderly';
}

function getAgeGroupColor(age?: number): string {
  if (!age) return 'text-clinical-slate';
  if (age < 18)  return 'text-clinical-blue';
  if (age >= 65) return 'text-clinical-amber';
  return 'text-clinical-slate';
}

export function HpiTab({ medicalCase }: HpiTabProps) {
  const ageGroup = getAgeGroup(medicalCase.age);

  return (
    <motion.div key="hpi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">

      {/* ── Patient demographic badge ─────────────────────────────────── */}
      <div className="panel">
        <div className="panel-body">
          <div className="flex flex-wrap items-center gap-4">
            {/* Avatar */}
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg border-2',
              medicalCase.gender?.toLowerCase().includes('f')
                ? 'bg-pink-50 border-pink-200 text-pink-600'
                : medicalCase.gender?.toLowerCase().includes('m')
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-clinical-bg border-clinical-line text-clinical-slate'
            )}>
              {medicalCase.gender?.toLowerCase().includes('f') ? '♀' : medicalCase.gender?.toLowerCase().includes('m') ? '♂' : '⚧'}
            </div>

            {/* Core info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-clinical-ink">{medicalCase.patientName}</h2>
                <span className={cn('text-[10px] font-semibold uppercase', getAgeGroupColor(medicalCase.age))}>
                  {medicalCase.age}y · {ageGroup}
                </span>
                {medicalCase.gender && (
                  <span className="text-[10px] text-clinical-slate capitalize">{medicalCase.gender}</span>
                )}
              </div>
              <p className="text-sm text-clinical-ink font-medium truncate">
                "{medicalCase.chiefComplaint}"
              </p>
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {medicalCase.difficulty && (
                <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize', getDifficultyColor(medicalCase.difficulty))}>
                  {medicalCase.difficulty}
                </span>
              )}
              {medicalCase.category && (
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-clinical-line bg-clinical-bg text-clinical-slate capitalize">
                  {medicalCase.category}
                </span>
              )}
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-clinical-line bg-clinical-bg text-clinical-slate flex items-center gap-1">
                <MapPin className="w-3 h-3" />{medicalCase.currentLocation}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Intake documentation ──────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Intake Documentation</span>
        </div>
        <div className="p-5 space-y-6">
          {/* First impression */}
          {medicalCase.initialAppearance && (
            <section>
              <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-1.5">
                Initial Appearance
              </label>
              <p className="text-sm text-clinical-ink px-3 py-2 bg-clinical-bg/60 border-l-2 border-clinical-blue/40 rounded-r leading-snug">
                {medicalCase.initialAppearance}
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <label className="text-[10px] font-medium text-clinical-slate uppercase block mb-2 border-b border-clinical-line/50 pb-1">
                History of Present Illness
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
                {(medicalCase.pastMedicalHistory || []).length === 0 ? (
                  <p className="text-xs text-clinical-slate/50 italic">None documented</p>
                ) : (medicalCase.pastMedicalHistory || []).map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-clinical-ink">
                    <div className="w-1 h-1 bg-clinical-slate/30 rounded-full shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
