import { motion } from 'motion/react';
import { AlertCircle, Clock, MapPin, Thermometer, Heart, Wind } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MedicalCase } from '../../types';

interface TriageTabProps {
  medicalCase: MedicalCase;
}

function getAcuityLevel(mc: MedicalCase): { level: number; label: string; color: string } {
  const hr = mc.vitals.heartRate;
  const rr = mc.vitals.respiratoryRate;
  const spo2 = mc.vitals.oxygenSaturation;
  const sbp = parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120;

  if (spo2 < 88 || sbp < 80 || hr > 150 || hr < 40) return { level: 1, label: 'Resuscitation', color: 'text-red-700 bg-red-100 border-red-400' };
  if (spo2 < 92 || sbp < 90 || hr > 130 || rr > 28) return { level: 2, label: 'Emergent', color: 'text-red-600 bg-red-50 border-red-300' };
  if (hr > 100 || rr > 22 || sbp > 160) return { level: 3, label: 'Urgent', color: 'text-amber-700 bg-amber-50 border-amber-300' };
  if (hr > 80 || rr > 18) return { level: 4, label: 'Less Urgent', color: 'text-blue-700 bg-blue-50 border-blue-300' };
  return { level: 5, label: 'Non-Urgent', color: 'text-green-700 bg-green-50 border-green-300' };
}

export function TriageTab({ medicalCase }: TriageTabProps) {
  const acuity = getAcuityLevel(medicalCase);
  const sbp = parseInt(medicalCase.vitals.bloodPressure.split('/')[0]) || 120;
  const dbp = parseInt(medicalCase.vitals.bloodPressure.split('/')[1]) || 80;

  return (
    <motion.div key="triage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      {/* Patient presentation card */}
      <div className="panel border-t-4 border-t-teal-500">
        <div className="panel-header">
          <span className="panel-title">Triage Assessment</span>
          <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border', acuity.color)}>
            ESI Level {acuity.level} — {acuity.label}
          </span>
        </div>
        <div className="p-5 space-y-5">
          {/* Patient header */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-teal-50 border-2 border-teal-200 inline-flex items-center justify-center text-sm shrink-0">
                {medicalCase.gender?.toLowerCase().includes('f') ? '♀' : '♂'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-clinical-ink">{medicalCase.patientName}</h2>
                <p className="text-sm text-clinical-slate">
                  {medicalCase.age}y {medicalCase.gender} · {medicalCase.currentLocation}
                </p>
              </div>
            </div>
            {medicalCase.difficulty && (
              <span className={cn(
                'text-[10px] font-semibold px-3 py-1.5 rounded-full border capitalize',
                medicalCase.difficulty === 'attending' ? 'bg-red-50 text-red-700 border-red-200' :
                medicalCase.difficulty === 'intern' ? 'bg-green-50 text-green-700 border-green-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              )}>
                {medicalCase.difficulty}
              </span>
            )}
          </div>

          {/* Chief complaint - the main focus */}
          <div className="bg-clinical-bg rounded-lg p-4 border-l-4 border-teal-500">
            <label className="text-[10px] font-bold text-teal-700 uppercase tracking-wide block mb-1.5">
              Chief Complaint
            </label>
            <p className="text-base font-semibold text-clinical-ink">
              "{medicalCase.chiefComplaint}"
            </p>
          </div>

          {/* Initial appearance */}
          {medicalCase.initialAppearance && (
            <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100">
              <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wide block mb-1.5">
                Initial Appearance (First Glance)
              </label>
              <p className="text-sm text-clinical-ink italic leading-relaxed">
                {medicalCase.initialAppearance}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Vitals at triage */}
      <details className="panel">
        <summary className="panel-header cursor-pointer list-none">
          <span className="panel-title">View initial vitals snapshot</span>
          <span className="text-[10px] text-clinical-slate">Obtained at presentation</span>
        </summary>
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: <Heart className="w-4 h-4" />, label: 'Heart Rate', value: `${medicalCase.vitals.heartRate}`, unit: 'bpm', critical: medicalCase.vitals.heartRate > 130 || medicalCase.vitals.heartRate < 50 },
              { icon: <AlertCircle className="w-4 h-4" />, label: 'Blood Pressure', value: medicalCase.vitals.bloodPressure, unit: 'mmHg', critical: sbp < 90 || sbp > 180 },
              { icon: <Wind className="w-4 h-4" />, label: 'Resp Rate', value: `${medicalCase.vitals.respiratoryRate}`, unit: '/min', critical: medicalCase.vitals.respiratoryRate > 28 || medicalCase.vitals.respiratoryRate < 8 },
              { icon: <Thermometer className="w-4 h-4" />, label: 'Temperature', value: `${medicalCase.vitals.temperature}`, unit: '°C', critical: medicalCase.vitals.temperature > 39.5 || medicalCase.vitals.temperature < 35 },
              { icon: <Clock className="w-4 h-4" />, label: 'SpO₂', value: `${medicalCase.vitals.oxygenSaturation}`, unit: '%', critical: medicalCase.vitals.oxygenSaturation < 92 },
            ].map(v => (
              <div key={v.label} className={cn(
                'p-3 rounded-lg border text-center',
                v.critical ? 'bg-red-50 border-red-200' : 'bg-clinical-bg/50 border-clinical-line'
              )}>
                <div className={cn('mx-auto mb-1', v.critical ? 'text-red-500' : 'text-clinical-slate/50')}>
                  {v.icon}
                </div>
                <div className={cn('text-lg font-bold font-mono', v.critical ? 'text-red-700' : 'text-clinical-ink')}>
                  {v.value}
                </div>
                <div className="text-[9px] text-clinical-slate/60 uppercase">{v.unit}</div>
                <div className="text-[9px] text-clinical-slate/40 mt-0.5">{v.label}</div>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Quick info */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Initial Information</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-semibold text-clinical-slate uppercase block mb-1">EMS / Triage Report</label>
            <p className="text-sm text-clinical-ink leading-relaxed">
              {medicalCase.historyOfPresentIllness}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-clinical-slate uppercase block mb-1">Known Medical History</label>
            <div className="space-y-1">
              {(medicalCase.pastMedicalHistory || []).length === 0 ? (
                <p className="text-xs text-clinical-slate/50 italic">None reported</p>
              ) : medicalCase.pastMedicalHistory.map((h, i) => (
                <span key={i} className="inline-block mr-2 mb-1 px-2 py-1 bg-clinical-bg border border-clinical-line rounded text-[11px] text-clinical-ink">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
